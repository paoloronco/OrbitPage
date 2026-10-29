import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let failures = 0;
function check(condition, label) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}

// Exercise each lockfile's installed packages through real local HTTP and HMR.
for (const target of ['frontend', 'backend']) {
  const require = createRequire(join(appRoot, target === 'frontend' ? 'package.json' : 'server/package.json'));
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const { interceptorPlugin } = await import(pathToFileURL(require.resolve('@vitest/mocker/node')).href);
  const fixture = await mkdtemp(join(tmpdir(), 'orbitpage-mocker-'));
  const root = join(fixture, 'root');
  await mkdir(root);
  for (const name of ['module', 'manual-0', 'manual-1', 'manual-2', 'allowed', 'slash', 'backslash', 'mixed']) {
    await writeFile(join(root, `${name}.js`), 'export const value = "REAL_MODULE";');
  }
  await writeFile(join(root, 'inside.js'), 'export const value = "INSIDE_ROOT_CANARY";');
  await writeFile(join(fixture, 'outside.js'), 'export const value = "OUTSIDE_ROOT_CANARY";');
  const server = await createServer({
    root, configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [root] } },
    plugins: [interceptorPlugin()],
  });
  let socket;
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    socket = new WebSocket(origin.replace('http:', 'ws:'), 'vite-hmr');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HMR connection timed out')), 5000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('HMR connection failed')); }, { once: true });
    });
    let acknowledge;
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.type !== 'custom') return;
      if (message.event === 'vitest:interceptor:resolve') {
        socket.send(JSON.stringify({ type: 'custom', event: 'vitest:interceptor:resolved', data: { url: message.data, keys: ['value'] } }));
      } else if (message.event === 'vitest:interceptor:register:result') acknowledge?.();
    });
    const register = event => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Mock registration timed out')), 5000);
      acknowledge = () => { clearTimeout(timer); acknowledge = undefined; resolve(); };
      socket.send(JSON.stringify({ type: 'custom', event: 'vitest:interceptor:register', data: event }));
    });
    const read = async path => {
      const response = await fetch(`${origin}/${path}.js`, { signal: AbortSignal.timeout(10_000) });
      return { status: response.status, body: await response.text() };
    };
    const original = await read('module');
    check(original.status === 200 && original.body.includes('REAL_MODULE'), `${target}: original module control`);
    for (const [index, url] of ['/benign', 'x");globalThis.MOCKER_INJECTED=1;void("', 'quote"\\backslash\nnewline'].entries()) {
      const name = `manual-${index}`;
      await register({ type: 'manual', raw: '', id: `${server.config.root}/${name}.js`, url });
      const result = await read(name);
      // Only inspect generated source: never evaluate the supplied JavaScript.
      check(result.status === 200 && result.body.includes(`getFactoryModule(${JSON.stringify(url)})`) && !result.body.includes('REAL_MODULE'),
        `${target}: manual URL remains one string literal (${JSON.stringify(url)})`);
    }
    for (const [name, redirect, allowed] of [
      ['allowed', 'fixture:inside.js', true],
      ['slash', 'fixture:../outside.js', false],
      ['backslash', 'fixture:..\\outside.js', false],
      ['mixed', 'fixture:../root/..\\outside.js', false],
    ]) {
      await register({ type: 'redirect', raw: '', id: `${server.config.root}/${name}.js`, url: `/${name}.js`, redirect });
      const result = await read(name);
      check(allowed ? result.status === 200 && result.body.includes('INSIDE_ROOT_CANARY') : !result.body.includes('OUTSIDE_ROOT_CANARY'),
        `${target}: ${name} redirect ${allowed ? 'works' : 'cannot read outside root'} (${process.platform})`);
    }
  } finally {
    socket?.close();
    await server.close();
    await rm(fixture, { recursive: true, force: true });
  }
}
if (failures) process.exitCode = 1;
