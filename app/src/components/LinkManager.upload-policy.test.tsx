import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '@/lib/theme';
import { LinkManager } from './LinkManager';

describe('content editor video upload policy', () => {
  const render = (videoUploadsEnabled: boolean, maxVideoUploadBytes: number) => renderToStaticMarkup(
    <LinkManager
      links={[{ id: 'video', type: 'video', title: 'Video', description: '', url: '' }]}
      theme={defaultTheme}
      onLinksUpdate={() => {}}
      visualMode
      visualFocusLinkId="video"
      videoUploadsEnabled={videoUploadsEnabled}
      maxVideoUploadBytes={maxVideoUploadBytes}
    />,
  );

  it('shows the allowance supplied by the workspace instead of the self-hosted default', () => {
    expect(render(true, 2 * 1024 * 1024).includes('up to 2 MB')).toBe(true);
  });

  it('disables uploads on a workspace without video upload access', () => {
    expect(/aria-label="Video uploads require Pro"[^>]*disabled=""/.test(render(false, 2 * 1024 * 1024))).toBe(true);
  });
});
