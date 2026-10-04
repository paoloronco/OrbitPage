import { describe, it, expect } from 'vitest';
import { assertEmbedChangesAllowed } from './embed-authorization.js';
const block = (snippet, extra = {}) => ({ id: '1', type: 'embed', isActive: true, content: JSON.stringify({ snippet, provider: 'auto', consentCategory: 'marketing', ...extra }) });
describe('editor embed authorization', () => {
  it('permits provider URLs and refuses markup, unrelated hosts and consent bypasses', () => {
    expect(() => assertEmbedChangesAllowed([], [block('https://www.youtube.com/watch?v=abc')])).not.toThrow();
    for (const value of [block('<script src="https://www.youtube.com/evil"></script>', { provider: 'youtube' }), block('https://youtube.com.attacker.test/a'), block('https://www.youtube.com/a', { consentCategory: 'necessary' }), block('https://user:pass@www.youtube.com/a')]) {
      expect(() => assertEmbedChangesAllowed([], [value])).toThrow('administrator');
      expect(() => assertEmbedChangesAllowed([], [value], ['users:manage'])).not.toThrow();
    }
  });
  it('preserves cosmetic edits to approved code and refuses activation by editors', () => {
    const old = block('<script>alert(1)</script>', { provider: 'custom' });
    expect(() => assertEmbedChangesAllowed([old], [{ ...old, content: JSON.stringify({ ...JSON.parse(old.content), height: 500 }) }])).not.toThrow();
    expect(() => assertEmbedChangesAllowed([{ ...old, isActive: false }], [old])).toThrow('administrator');
    expect(() => assertEmbedChangesAllowed([{ ...old, status: 'draft' }], [old])).toThrow('administrator');
    expect(() => assertEmbedChangesAllowed([{ ...old, start_date: '2099-01-01' }], [old])).toThrow('administrator');
  });
});
