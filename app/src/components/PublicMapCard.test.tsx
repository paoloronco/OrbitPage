import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicMapCard } from './PublicMapCard';

describe('map provider label', () => {
  it('ignores provider names inside the Google Maps query', () => {
    const html = renderToStaticMarkup(<PublicMapCard link={{ id: 'map', type: 'map', title: 'Map', description: '', url: '', content: JSON.stringify({ address: 'openstreetmap.org/' }) }} />);
    expect(html).toContain('Open cookie preferences to load Google Maps.');
    expect(html).not.toContain('load OpenStreetMap.');
  });
});
