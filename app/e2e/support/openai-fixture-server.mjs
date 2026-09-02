import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 3124);
const MAX_BODY_BYTES = 128 * 1024;
const E2E_BIO = 'OrbitPage AI E2E verified this page update.';

const operation = (overrides = {}) => ({
  kind: 'profile.set',
  targetId: null,
  field: 'bio',
  value: E2E_BIO,
  blockType: null,
  title: null,
  description: null,
  url: null,
  content: null,
  index: null,
  ...overrides,
});

const json = (response, status, payload) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
};

const completed = (plan) => ({
  status: 'completed',
  output: [{
    type: 'message',
    content: [{ type: 'output_text', text: JSON.stringify(plan) }],
  }],
});

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return json(response, 200, { status: 'ok' });
  }
  if (request.method !== 'POST' || request.url !== '/v1/responses') {
    return json(response, 404, { error: 'Not found' });
  }

  let size = 0;
  const chunks = [];
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) request.destroy();
    else chunks.push(chunk);
  });
  request.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json(response, 400, { error: 'Invalid JSON' });
    }

    const latestMessage = [...(Array.isArray(payload.input) ? payload.input : [])]
      .reverse()
      .find((item) => item?.role === 'user' && typeof item?.content === 'string')
      ?.content || '';
    const unsafe = latestMessage.includes('E2E_UNSAFE_URL');
    const plan = unsafe
      ? {
          intent: 'propose_changes',
          answer: 'I prepared a link proposal for review.',
          summary: 'Add a provider-supplied unsafe link.',
          operations: [operation({
            kind: 'block.add',
            field: null,
            value: null,
            blockType: 'link',
            title: 'Unsafe fixture link',
            description: '',
            url: 'javascript:alert(1)',
          })],
        }
      : {
          intent: 'propose_changes',
          answer: 'I prepared the requested biography update for review.',
          summary: 'Update the public biography.',
          operations: [operation()],
        };

    return json(response, 200, completed(plan));
  });
}).listen(PORT, '127.0.0.1');
