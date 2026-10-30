import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicEmbedCard } from './PublicEmbedCard';

const consent = vi.hoisted(() => ({ granted: true }));
vi.mock('@/lib/consent-manager', () => ({ consentManager: {
  isGranted: () => consent.granted,
  onConsentChange: () => () => {},
  showBanner: vi.fn(), openPreferences: vi.fn(),
} }));

const render = (title = '', description = '') => renderToStaticMarkup(<PublicEmbedCard link={{
  id: 'youtube-test', type: 'embed', title, description, url: '',
  content: JSON.stringify({ provider: 'youtube', snippet: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', consentCategory: 'marketing', height: 360 }),
}} />);

beforeEach(() => { consent.granted = true; });

describe('YouTube player-only cards', () => {
  it('keeps the accessible responsive player while omitting an empty header', () => {
    const html = render();
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('aspect-ratio:16 / 9');
    expect(html).toContain('title="YouTube: embedded content"');
    expect(html).not.toContain('public-block-header');
  });

  it.each([['Video title', ''], ['', 'Optional introduction']])('retains a header when optional text is provided', (title, description) => {
    const html = render(title, description);
    expect(html).toContain('public-block-header');
    expect(html).toContain(title || description);
  });

  it('continues to block the player before marketing consent', () => {
    consent.granted = false;
    const html = render();
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('youtube-nocookie.com');
    expect(html).toContain('Third-party content blocked');
    expect(html).toContain('Manage cookie preferences');
  });
});
