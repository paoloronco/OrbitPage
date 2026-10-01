import http from 'node:http';
import { join } from 'node:path';

// The host owns the updater; the app never receives a Docker socket or runs sudo.
export function updateAgentRequest(dataDir, version) {
  return new Promise((resolve, reject) => {
    const body = version ? JSON.stringify({ version }) : null;
    const request = http.request({
      socketPath: join(dataDir, '.orbitpage-update.sock'), path: '/updates',
      method: body ? 'POST' : 'GET', timeout: 4000,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 128 * 1024) request.destroy(new Error('Invalid updater response.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString());
          if (response.statusCode !== 200 && response.statusCode !== 202) {
            throw Object.assign(new Error(result.error || 'Host updater unavailable.'), { status: response.statusCode });
          }
          if (result.enabled !== true || (result.job && !['queued', 'running', 'completed', 'failed'].includes(result.job.state))) {
            throw new Error('Invalid updater response.');
          }
          resolve(result);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Host updater did not respond.')));
    request.on('error', error => {
      if (!body && ['ENOENT', 'ECONNREFUSED'].includes(error.code)) resolve({ enabled: false, job: null });
      else reject(error);
    });
    request.end(body);
  });
}

export const isUpdateActive = job => ['queued', 'running'].includes(job?.state);
