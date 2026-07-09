import { describe, expect, it, vi } from 'vitest';

import { commitWorkingLinks } from './link-save-state';

describe('commitWorkingLinks', () => {
  it('keeps changes dirty and returns an inline error when saving fails', async () => {
    const links = [{ id: '1', title: 'Portfolio' }];
    const onSave = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await commitWorkingLinks({
      isDirty: true,
      links,
      onSave,
    });

    expect(onSave).toHaveBeenCalledWith(links);
    expect(result).toEqual({
      saved: false,
      isDirty: true,
      error: 'Network offline',
    });
  });
});
