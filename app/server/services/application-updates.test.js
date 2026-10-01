import { EventEmitter } from 'node:events';
import http from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { updateAgentRequest } from './application-updates.js';

afterEach(() => vi.restoreAllMocks());
it('uses only the local host socket, bounds responses and fails when the host does not answer', async () => {
  let mode = 'ok';
  const sent = [];
  const mock = vi.spyOn(http, 'request').mockImplementation((options, respond) => {
    const request = new EventEmitter();
    request.destroy = error => request.emit('error', error);
    request.end = body => {
      sent.push({ options, body });
      queueMicrotask(() => {
        if (mode === 'missing') return request.emit('error', Object.assign(new Error('Missing socket'), { code: 'ENOENT' }));
        if (mode === 'timeout') return request.emit('timeout');
        const response = new EventEmitter(); response.statusCode = 200; respond(response);
        response.emit('data', mode === 'large' ? Buffer.alloc(128 * 1024 + 1) : Buffer.from(JSON.stringify({ enabled: true, job: null })));
        response.emit('end');
      });
    };
    return request;
  });
  expect(await updateAgentRequest('/isolated/data')).toEqual({ enabled: true, job: null });
  await updateAgentRequest('/isolated/data', '4.21.35');
  expect(sent[1].options).toMatchObject({ socketPath: expect.stringContaining('.orbitpage-update.sock'), path: '/updates', method: 'POST', timeout: 4000 });
  expect(JSON.parse(sent[1].body)).toEqual({ version: '4.21.35' });
  mode = 'missing';
  expect(await updateAgentRequest('/isolated/data')).toEqual({ enabled: false, job: null });
  await expect(updateAgentRequest('/isolated/data', '4.21.35')).rejects.toThrow('Missing socket');
  mode = 'timeout'; await expect(updateAgentRequest('/isolated/data')).rejects.toThrow('did not respond');
  mode = 'large'; await expect(updateAgentRequest('/isolated/data')).rejects.toThrow('Invalid updater response');
  expect(mock).toHaveBeenCalled();
});
