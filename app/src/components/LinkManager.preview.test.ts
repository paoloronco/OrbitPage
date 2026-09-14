import { describe, expect, it } from 'vitest';
import type { LinkData } from './LinkCard';
import { mergeLinkPreviews } from './link-preview-state';

describe('mergeLinkPreviews', () => {
  it('replaces only cards with a live editing draft', () => {
    const first = { id: '1', title: 'First', description: '', url: '' };
    const second = { id: '2', title: 'Second', description: '', url: '' };
    const draft = { ...second, title: 'Live title' };

    expect(mergeLinkPreviews([first, second], new Map<string, LinkData>([['2', draft]])))
      .toEqual([first, draft]);
  });
});
