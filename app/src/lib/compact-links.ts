import type { CSSProperties } from 'react';
import type { SocialLinkPlatform } from './link-blocks';

const brandColors: Partial<Record<SocialLinkPlatform, string>> = {
  instagram: '#d62976', facebook: '#1877f2', tiktok: '#111111', x: '#111111',
  youtube: '#ff0000', linkedin: '#0a66c2', whatsapp: '#25d366', telegram: '#229ed9',
  discord: '#5865f2', github: '#24292f', email: '#475569', page: '#315bd8',
  link: '#315bd8', website: '#2454d6',
};

export function getCompactLinkAccessibleLabel(platform: SocialLinkPlatform, url: string, label?: string): string {
  if (label?.trim()) return label.trim();
  const resolved = platform === 'auto' ? detectCompactLinkPlatform(url) : platform;
  return compactLinkPlatformOptions.find((option) => option.value === resolved)?.label || 'Link';
}

export const compactLinkPlatformOptions: Array<{ value: SocialLinkPlatform; label: string }> = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'page', label: 'OrbitPage page' },
  { value: 'link', label: 'Generic link' },
  { value: 'website', label: 'Website' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'github', label: 'GitHub' },
  { value: 'email', label: 'Email' },
];

export function detectCompactLinkPlatform(url: string): Exclude<SocialLinkPlatform, 'auto'> {
  const value = url.trim().toLowerCase();
  if (!value) return 'link';
  if (value.startsWith('/') || value.startsWith('#')) return 'page';
  if (value.startsWith('mailto:')) return 'email';
  if (value.startsWith('https://orbitpage.net/') || value.includes('/menu')) return 'page';

  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return 'instagram';
    if (host === 'facebook.com' || host === 'fb.com') return 'facebook';
    if (host === 'tiktok.com') return 'tiktok';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
    if (host === 'linkedin.com') return 'linkedin';
    if (host === 'wa.me' || host === 'whatsapp.com') return 'whatsapp';
    if (host === 't.me' || host === 'telegram.me') return 'telegram';
    if (host === 'discord.com' || host === 'discord.gg') return 'discord';
    if (host === 'github.com') return 'github';
    return 'website';
  } catch {
    return 'link';
  }
}

export function getCompactLinkBrandStyle(platform: SocialLinkPlatform, url: string): CSSProperties {
  const resolved = platform === 'auto' ? detectCompactLinkPlatform(url) : platform;
  return { backgroundColor: brandColors[resolved] || brandColors.link, color: '#ffffff' };
}

export function getSafeCompactLinkHref(url: string): string | null {
  const value = url.trim();
  if (value.startsWith('/') || value.startsWith('#')) return value;

  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export type CompactLinkInputKind = 'username' | 'phone' | 'email' | 'url';

export function getCompactLinkInputKind(platform: SocialLinkPlatform): CompactLinkInputKind {
  if (platform === 'whatsapp') return 'phone';
  if (platform === 'email') return 'email';
  if (['instagram', 'facebook', 'tiktok', 'x', 'youtube', 'telegram', 'github'].includes(platform)) {
    return 'username';
  }
  return 'url';
}

const cleanUsername = (value: string) => value.trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, '');

const buildUsernameHref = (platform: SocialLinkPlatform, rawValue: string): string | null => {
  const username = cleanUsername(rawValue);
  if (!username || username.length > 100 || !/^[a-z0-9._-]+$/i.test(username)) return null;

  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${username}/`;
    case 'facebook': return `https://www.facebook.com/${username}/`;
    case 'tiktok': return `https://www.tiktok.com/@${username}`;
    case 'x': return `https://x.com/${username}`;
    case 'youtube': return `https://www.youtube.com/@${username}`;
    case 'telegram': return `https://t.me/${username}`;
    case 'github': return `https://github.com/${username}`;
    default: return null;
  }
};

/**
 * Resolves the compact value into a safe public URL. Existing absolute URLs
 * remain valid, while social presets can store a username, phone or email.
 */
export function getCompactLinkHref(platform: SocialLinkPlatform, value: string): string | null {
  const rawValue = value.trim();
  if (!rawValue) return null;

  const existingHref = getSafeCompactLinkHref(rawValue);
  if (existingHref) return existingHref;

  const resolvedPlatform = platform === 'auto' ? detectCompactLinkPlatform(rawValue) : platform;
  const usernameHref = buildUsernameHref(resolvedPlatform, rawValue);
  if (usernameHref) return usernameHref;

  if (resolvedPlatform === 'whatsapp') {
    const phone = rawValue.replace(/[^0-9]/g, '');
    return phone.length >= 6 && phone.length <= 15 ? `https://wa.me/${phone}` : null;
  }

  if (resolvedPlatform === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue) ? `mailto:${rawValue}` : null;
  }

  return null;
}
