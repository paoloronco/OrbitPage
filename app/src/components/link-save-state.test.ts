import { describe, expect, it, vi } from 'vitest';

import { commitWorkingLinks, prepareLinkForSave } from './link-save-state';

describe('commitWorkingLinks', () => {
  it('trims map text only when preparing the saved payload', async () => {
    const result = await prepareLinkForSave({
      id: 'map',
      type: 'map',
      title: 'Map',
      description: '',
      url: '',
      content: JSON.stringify({
        placeName: 'OrbitPage Office ',
        address: ' Via Roma 1 ',
        mapUrl: 'https://maps.google.com/?q=45.0703,7.6869',
      }),
    });
    const content = JSON.parse(result.content || '{}');

    expect(content).toMatchObject({
      placeName: 'OrbitPage Office',
      address: 'Via Roma 1',
      latitude: '45.0703',
      longitude: '7.6869',
    });
  });

  it('removes unused card copy and hidden descriptions from horizontal navigation', async () => {
    const result = await prepareLinkForSave({
      id: 'navigation',
      type: 'internal_links',
      title: 'Internal page navigation',
      description: 'Old card description',
      url: '/unused',
      content: JSON.stringify({
        items: [{ id: 'home', kind: 'link', path: '/', label: 'Home' }],
        layout: 'tabs',
        showDescriptions: true,
      }),
    });

    expect(result).toMatchObject({ title: '', description: '', url: '', hideUrl: true });
    expect(JSON.parse(result.content || '{}')).toMatchObject({ layout: 'tabs', showDescriptions: false });
  });

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
