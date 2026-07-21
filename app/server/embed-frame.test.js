import { describe, expect, it } from 'vitest';
import { EMBED_FRAME_CSP, buildEmbedFrameDocument, prepareEmbedMarkup } from './embed-frame.js';

describe('secure embed frame', () => {
  it('uses the YouTube privacy-enhanced domain', () => {
    expect(prepareEmbedMarkup('<iframe src="https://www.youtube.com/embed/abc"></iframe>'))
      .toContain('https://www.youtube-nocookie.com/embed/abc');
  });

  it('wraps a direct HTTPS URL in an iframe', () => {
    const markup = prepareEmbedMarkup('https://open.spotify.com/embed/track/example');
    expect(markup).toContain('<iframe');
    expect(markup).toContain('https://open.spotify.com/embed/track/example');
    expect(markup).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(markup).not.toContain('referrerpolicy="no-referrer"');
  });

  it('keeps arbitrary markup inside the isolated document', () => {
    const document = buildEmbedFrameDocument('<div data-widget="example"></div>');
    expect(document).toContain('<div data-widget="example"></div>');
    expect(EMBED_FRAME_CSP).toContain("frame-ancestors 'self'");
    expect(EMBED_FRAME_CSP).toContain('sandbox allow-scripts');
  });
});
