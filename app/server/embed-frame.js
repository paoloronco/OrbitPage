const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const normalizeYouTubePrivacyDomain = (snippet) => snippet
  .replace(/https:\/\/(?:www\.)?youtube\.com\/embed\//gi, 'https://www.youtube-nocookie.com/embed/');

export const EMBED_FRAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "media-src blob: https:",
  "frame-src https:",
  "connect-src https: wss:",
  "worker-src blob: https:",
  "form-action https:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  'sandbox allow-scripts allow-forms allow-popups allow-presentation',
].join('; ');

export const prepareEmbedMarkup = (rawSnippet) => {
  const snippet = typeof rawSnippet === 'string' ? rawSnippet.trim() : '';
  if (!snippet) return '';

  try {
    const directUrl = new URL(snippet);
    if (directUrl.protocol === 'https:') {
      return `<iframe src="${escapeHtml(normalizeYouTubePrivacyDomain(directUrl.toString()))}" title="Embedded content" loading="lazy" referrerpolicy="no-referrer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }
  } catch {
    // Full snippets are handled below inside the isolated frame.
  }

  return normalizeYouTubePrivacyDomain(snippet);
};

const documentShell = (body, title) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;color:#172033;font-family:system-ui,sans-serif}
    body{overflow:auto}iframe,video,embed{display:block;width:100%;height:100%;min-height:100%;border:0}img{max-width:100%;height:auto}
  </style>
</head>
<body>${body}</body>
</html>`;

export const buildEmbedFrameDocument = (snippet) => documentShell(prepareEmbedMarkup(snippet), 'Embedded content');

export const buildEmbedFrameErrorDocument = (message = 'Embed unavailable') => documentShell(
  `<main style="min-height:100%;display:grid;place-items:center;padding:24px;text-align:center"><div><strong>${escapeHtml(message)}</strong><p style="margin:8px 0 0;color:#64748b;font-size:13px">Save a valid HTTPS embed snippet and publish the block.</p></div></main>`,
  'Embed unavailable',
);
