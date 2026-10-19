import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapPreviewApi } from '@/lib/api-client';

import { commitWorkingLinks, prepareLinkForSave } from './link-save-state';

describe('commitWorkingLinks', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves address previews without a provider request and discards stale coordinates', async () => {
    const resolve = vi.spyOn(mapPreviewApi, 'resolve');
    const saved = await prepareLinkForSave({ id: 'map', type: 'map', title: 'Map', description: '', url: '',
      content: JSON.stringify({ address: 'Torino', latitude: '40', longitude: '10', resolvedSource: '|Old address|' }),
    });
    expect(JSON.parse(saved.content || '{}')).toMatchObject({ address: 'Torino', resolvedSource: '|Torino|' });
    expect(JSON.parse(saved.content || '{}').latitude).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('expands a short URL once, keeps the original input and reuses the saved result', async () => {
    const resolve = vi.spyOn(mapPreviewApi, 'resolve').mockResolvedValue({
      resolvedUrl: 'https://www.google.com/maps/place/Torino', displayName: 'Torino', source: 'redirect',
    });
    const saved = await prepareLinkForSave({ id: 'map', type: 'map', title: 'Map', description: '', url: '',
      content: JSON.stringify({ mapUrl: 'https://maps.app.goo.gl/torino', placeName: 'Office' }),
    });
    expect(JSON.parse(saved.content || '{}')).toMatchObject({ mapUrl: 'https://maps.app.goo.gl/torino', resolvedUrl: 'https://www.google.com/maps/place/Torino' });
    await prepareLinkForSave(saved);
    expect(resolve).toHaveBeenCalledOnce();
  });

  it('preserves an unsaved map when short URL resolution fails', async () => {
    vi.spyOn(mapPreviewApi, 'resolve').mockRejectedValue(new Error('Map unavailable'));
    const map = { id: 'map', type: 'map' as const, title: 'Map', description: '', url: '', content: '{"mapUrl":"https://maps.app.goo.gl/failure"}' };
    await expect(prepareLinkForSave(map)).rejects.toThrow('Map unavailable');
    expect(map.content).toContain('failure');
  });
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
