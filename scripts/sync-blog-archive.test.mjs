import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { syncBlogArchive } from './sync-blog-archive.mjs';

const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'orbitpage-blog-')));
    await rm(root, { recursive: true, force: true });
  }
});
const digest = text => createHash('sha256').update(text).digest('hex');
const source = (overrides = {}) => ({ slug: 'a-useful-public-page', locale: 'en', title: 'A useful [public] page', published: '2026-11-27', revision: digest('version1'), ...overrides });
async function setup(articles = [source()], options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'orbitpage-blog-')); roots.push(root);
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push(url);
    assert.equal(init.redirect, 'error');
    assert.equal(new URL(url).origin, 'https://orbitpage.com');
    if (url === 'https://orbitpage.com/api/blog/archive') return Response.json({ version: 1, articles });
    const locale = new URL(url).searchParams.get('locale');
    const text = `# Public article ${locale}\n\nFull content.\n`;
    return new Response(text, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-language': locale, 'x-content-sha256': digest(text) }, ...options });
  };
  return { root, requests, fetcher };
}

test('archives originals and translations, links every file and makes repeat syncs a no-op', async () => {
  const fixture = await setup([source(), source({ locale: 'it', title: 'Una pagina utile' })]);
  const first = await syncBlogArchive(fixture);
  assert.equal(first.downloaded, 2);
  const index = await readFile(join(fixture.root, 'docs/blog/README.md'), 'utf8');
  assert.ok(index.includes('./en/a-useful-public-page.md'));
  assert.ok(index.includes('./it/a-useful-public-page.md'));
  assert.ok(index.includes('A useful &#91;public&#93; page'));
  const before = fixture.requests.length;
  assert.deepEqual(await syncBlogArchive(fixture), { downloaded: 0, pending: 0, changed: 0, articles: 2 });
  assert.equal(fixture.requests.length, before + 1);
  await writeFile(join(fixture.root, 'docs/blog/en/a-useful-public-page.md'), 'damaged');
  assert.equal((await syncBlogArchive(fixture)).downloaded, 1);
});

test('rejects malicious paths, unknown languages, duplicate records and oversized metadata before writing', async () => {
  for (const articles of [[source({ slug: '../../.github/workflows/publish' })], [source({ locale: '../private' })], [source(), source()], [source({ slug: 'nul' })], [source({ title: 'x'.repeat(1001) })]]) {
    const fixture = await setup(articles);
    await assert.rejects(syncBlogArchive(fixture));
    assert.deepEqual(await readdir(fixture.root), []);
  }
});

test('a failed download or wrong language/hash leaves the previous archive intact', async () => {
  const fixture = await setup();
  await syncBlogArchive(fixture);
  const before = await readFile(join(fixture.root, 'docs/blog/manifest.json'), 'utf8');
  const fail = await setup([source({ revision: digest('version2') })], { status: 503 });
  await assert.rejects(syncBlogArchive({ ...fail, root: fixture.root }), /failed/);
  const invalid = await setup([source({ revision: digest('version2') })], { headers: { 'content-type': 'text/markdown', 'content-language': 'fr', 'x-content-sha256': 'bad' } });
  await assert.rejects(syncBlogArchive({ ...invalid, root: fixture.root }), /Invalid Markdown/);
  assert.equal(await readFile(join(fixture.root, 'docs/blog/manifest.json'), 'utf8'), before);
});

test('bounded runs continue on the next sync and never delete earlier published copies', async () => {
  const fixture = await setup([source(), source({ locale: 'it' })]);
  assert.equal((await syncBlogArchive({ ...fixture, maxDownloads: 1 })).pending, 1);
  assert.equal((await syncBlogArchive(fixture)).articles, 2);
  const smaller = await setup([source()]);
  assert.equal((await syncBlogArchive({ ...smaller, root: fixture.root })).articles, 2);
});

test('refuses symbolic-link destinations', async () => {
  const fixture = await setup();
  const outside = await setup();
  await mkdir(join(fixture.root, 'docs'), { recursive: true });
  await symlink(outside.root, join(fixture.root, 'docs/blog'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(syncBlogArchive(fixture), /symbolic links/);
  assert.deepEqual(await readdir(outside.root), []);
});
