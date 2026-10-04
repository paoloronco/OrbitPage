// Editors may configure provider URLs. Executable snippets and consent bypasses
// are owned by administrators, including when an existing block is activated.
const hosts = new Set(['instagram.com', 'www.instagram.com', 'facebook.com', 'www.facebook.com', 'm.facebook.com', 'youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'open.spotify.com', 'music.apple.com', 'embed.music.apple.com', 'deezer.com', 'www.deezer.com', 'widget.deezer.com', 'soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'w.soundcloud.com', 'mixcloud.com', 'www.mixcloud.com', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com', 'loom.com', 'www.loom.com', 'tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'giphy.com', 'www.giphy.com', 'media.giphy.com', 'calendar.google.com', 'calendly.com', 'www.calendly.com', 'docs.google.com', 'www.google.com', 'maps.google.com']);
const read = (link) => {
  try { return JSON.parse(link?.content || '{}'); } catch { return { snippet: link?.content || '' }; }
};
const safePreset = (embed) => {
  if (!embed.snippet) return true;
  if (!['preferences', 'analytics', 'marketing'].includes(embed.consentCategory) || ['custom', 'newsletter'].includes(embed.provider)) return false;
  try {
    const value = embed.snippet.trim();
    if (/[<>\s]/.test(value)) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && (hosts.has(url.hostname) || /^(?:[a-z0-9-]+\.)?typeform\.(?:com|eu)$/.test(url.hostname));
  } catch { return false; }
};
export function assertEmbedChangesAllowed(previous, next, permissions = []) {
  if (permissions.includes('users:manage')) return;
  const existing = new Map(previous.map((link) => [String(link.id), link]));
  for (const link of next.filter((item) => item.type === 'embed')) {
    const embed = read(link);
    if (safePreset(embed)) continue;
    const old = existing.get(String(link.id));
    const oldEmbed = read(old);
    const unchanged = old?.type === 'embed' && ['snippet', 'provider', 'consentCategory'].every((key) => embed[key] === oldEmbed[key]);
    const wasActive = old && (old.isActive ?? (old.is_active !== 0)) && (old.status || 'live') === 'live';
    const scheduling = ['startDate', 'startTime', 'endDate', 'endTime', 'timezone'];
    const value = (item, key) => item?.[key] ?? item?.[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] ?? '';
    const scheduleUnchanged = scheduling.every((key) => value(old, key) === value(link, key));
    const nextActive = link.isActive !== false && (link.status || 'live') === 'live';
    if (!unchanged || (nextActive && (!wasActive || !scheduleUnchanged))) throw new Error('Only an administrator can add, change or activate custom embeds or necessary third-party content.');
  }
}
