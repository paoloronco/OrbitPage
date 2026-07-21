export type LinkBlockType = 'link' | 'menu' | 'text' | 'separator' | 'cta' | 'heading' | 'image' | 'video' | 'contact' | 'social_row' | 'callout' | 'map' | 'event' | 'embed';

export interface VideoBlockData {
  mediaUrl?: string;
  posterUrl?: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  objectFit?: 'cover' | 'contain';
}

export interface ContactBlockData {
  name?: string;
  title?: string;
  role?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  note?: string;
  whatsapp?: string;
  telegram?: string;
}

export interface SocialRowItemData {
  id?: string;
  label: string;
  url: string;
  platform?: SocialLinkPlatform;
  icon?: string;
}

export type SocialRowLayout = 'icons' | 'pills' | 'grid';
export type SocialRowIconStyle = 'brand' | 'theme' | 'outline';
export type SocialLinkPlatform = 'auto' | 'page' | 'link' | 'website' | 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube' | 'linkedin' | 'whatsapp' | 'telegram' | 'discord' | 'github' | 'email';

export interface SocialRowBlockData {
  items?: SocialRowItemData[];
  layout?: SocialRowLayout;
  iconStyle?: SocialRowIconStyle;
  columns?: 2 | 3 | 4;
  boxed?: boolean;
  showTitle?: boolean;
  showLabels?: boolean;
}

export interface CalloutBlockData {
  badge?: string;
  buttonLabel?: string;
}

export interface MapBlockData {
  address?: string;
  placeName?: string;
  mapUrl?: string;
  latitude?: string;
  longitude?: string;
  resolvedSource?: string;
}

export interface EventBlockData {
  date?: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
  showCountdown?: boolean;
  location?: string;
  ticketLabel?: string;
  notes?: string;
}

export type EmbedProvider = 'auto' | 'instagram' | 'youtube' | 'spotify' | 'deezer' | 'soundcloud' | 'vimeo' | 'tiktok' | 'giphy' | 'google_calendar' | 'calendly' | 'google_maps' | 'newsletter' | 'custom';
export type EmbedConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';
export type ServiceLinkProvider = 'whatsapp' | 'github';

export interface EmbedBlockData {
  snippet?: string;
  provider?: EmbedProvider;
  consentCategory?: EmbedConsentCategory;
  height?: number;
}

export interface ServiceLinkBlockData {
  service?: ServiceLinkProvider;
}

export interface SeparatorBlockData {
  boxed?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = (value: string | null | undefined): unknown => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const toString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const socialRowLayouts: SocialRowLayout[] = ['icons', 'pills', 'grid'];
const socialRowIconStyles: SocialRowIconStyle[] = ['brand', 'theme', 'outline'];
const socialLinkPlatforms: SocialLinkPlatform[] = ['auto', 'page', 'link', 'website', 'instagram', 'facebook', 'tiktok', 'x', 'youtube', 'linkedin', 'whatsapp', 'telegram', 'discord', 'github', 'email'];

export const parseBlockContent = <T>(content: string | null | undefined): T | undefined => {
  const parsed = parseJson(content);
  if (parsed === undefined) return undefined;
  return (parsed as T);
};

export const buildBlockContent = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

export const getContactData = (content: string | null | undefined): ContactBlockData => {
  const parsed = parseBlockContent<ContactBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  return {
    name: normalize((parsed as Record<string, unknown>).name),
    title: normalize((parsed as Record<string, unknown>).title),
    role: normalize((parsed as Record<string, unknown>).role),
    phone: normalize((parsed as Record<string, unknown>).phone),
    email: normalize((parsed as Record<string, unknown>).email),
    website: normalize((parsed as Record<string, unknown>).website),
    address: normalize((parsed as Record<string, unknown>).address),
    note: normalize((parsed as Record<string, unknown>).note),
    whatsapp: normalize((parsed as Record<string, unknown>).whatsapp),
    telegram: normalize((parsed as Record<string, unknown>).telegram),
  };
};

export const getSocialRowDraftData = (content: string | null | undefined): SocialRowBlockData => {
  const parsed = parseBlockContent<SocialRowBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  const rawItems = Array.isArray((parsed as Record<string, unknown>).items)
    ? ((parsed as Record<string, unknown>).items as unknown[])
    : [];

  const items = rawItems
    .map((entry) => {
      if (!isPlainObject(entry)) return undefined;
      const id = toString(entry.id).trim().slice(0, 80);
      return {
        ...(id ? { id } : {}),
        label: toString(entry.label),
        url: toString(entry.url),
        platform: socialLinkPlatforms.includes(entry.platform as SocialLinkPlatform) ? entry.platform as SocialLinkPlatform : 'auto',
        icon: toString(entry.icon).slice(0, 24),
      };
    })
    .filter((item): item is SocialRowItemData => Boolean(item));

  const record = parsed as Record<string, unknown>;
  const layout = socialRowLayouts.includes(record.layout as SocialRowLayout) ? record.layout as SocialRowLayout : 'icons';
  const iconStyle = socialRowIconStyles.includes(record.iconStyle as SocialRowIconStyle) ? record.iconStyle as SocialRowIconStyle : 'brand';
  const columns = record.columns === 3 || record.columns === 4 ? record.columns : 2;

  return {
    items: items.slice(0, 16),
    layout,
    iconStyle,
    columns,
    boxed: record.boxed === true,
    showTitle: record.showTitle === true,
    showLabels: record.showLabels === true,
  };
};

export const getSocialRowData = (content: string | null | undefined): SocialRowBlockData => {
  const data = getSocialRowDraftData(content);
  return {
    ...data,
    layout: 'icons',
    boxed: false,
    showTitle: false,
    items: (data.items || []).filter((item) => Boolean(item.url)),
  };
};

export const getCalloutData = (content: string | null | undefined): CalloutBlockData => {
  const parsed = parseBlockContent<CalloutBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  return {
    badge: toString((parsed as Record<string, unknown>).badge),
    buttonLabel: toString((parsed as Record<string, unknown>).buttonLabel),
  };
};

export const getMapData = (content: string | null | undefined): MapBlockData => {
  const parsed = parseBlockContent<MapBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  return {
    address: toString((parsed as Record<string, unknown>).address),
    placeName: toString((parsed as Record<string, unknown>).placeName),
    mapUrl: toString((parsed as Record<string, unknown>).mapUrl),
    latitude: toString((parsed as Record<string, unknown>).latitude),
    longitude: toString((parsed as Record<string, unknown>).longitude),
    resolvedSource: toString((parsed as Record<string, unknown>).resolvedSource),
  };
};

export const getEventData = (content: string | null | undefined): EventBlockData => {
  const parsed = parseBlockContent<EventBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  return {
    date: toString((parsed as Record<string, unknown>).date),
    time: toString((parsed as Record<string, unknown>).time),
    endDate: toString((parsed as Record<string, unknown>).endDate),
    endTime: toString((parsed as Record<string, unknown>).endTime),
    timezone: toString((parsed as Record<string, unknown>).timezone),
    showCountdown: (parsed as Record<string, unknown>).showCountdown !== false,
    location: toString((parsed as Record<string, unknown>).location),
    ticketLabel: toString((parsed as Record<string, unknown>).ticketLabel),
    notes: toString((parsed as Record<string, unknown>).notes),
  };
};

const embedProviders: EmbedProvider[] = ['auto', 'instagram', 'youtube', 'spotify', 'deezer', 'soundcloud', 'vimeo', 'tiktok', 'giphy', 'google_calendar', 'calendly', 'google_maps', 'newsletter', 'custom'];
const embedConsentCategories: EmbedConsentCategory[] = ['necessary', 'preferences', 'analytics', 'marketing'];
const serviceLinkProviders: ServiceLinkProvider[] = ['whatsapp', 'github'];

export const detectEmbedProvider = (snippet?: string): Exclude<EmbedProvider, 'auto'> => {
  const value = (snippet || '').toLowerCase();
  if (value.includes('instagram.com')) return 'instagram';
  if (value.includes('youtu.be') || value.includes('youtube.com') || value.includes('youtube-nocookie.com')) return 'youtube';
  if (value.includes('spotify.com')) return 'spotify';
  if (value.includes('deezer.com')) return 'deezer';
  if (value.includes('soundcloud.com')) return 'soundcloud';
  if (value.includes('vimeo.com')) return 'vimeo';
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('giphy.com')) return 'giphy';
  if (value.includes('calendar.google.com/calendar/appointments/schedules/')) return 'google_calendar';
  if (value.includes('calendly.com')) return 'calendly';
  if (value.includes('google.com/maps') || value.includes('maps.google.')) return 'google_maps';
  if (value.includes('mailchimp') || value.includes('substack') || value.includes('beehiiv') || value.includes('convertkit') || value.includes('<form')) return 'newsletter';
  return 'custom';
};

const getEmbedUrlCandidates = (snippet?: string) => {
  const value = (snippet || '').trim();
  const candidates = /^https:\/\/\S+$/i.test(value) ? [value] : [];
  for (const match of value.matchAll(/(?:src|data-url)\s*=\s*["']([^"']+)["']/gi)) {
    if (match[1]) candidates.push(match[1].replaceAll('&amp;', '&'));
  }
  return candidates;
};

export const getKnownEmbedUrl = (provider: Exclude<EmbedProvider, 'auto'>, snippet?: string): string | null => {
  for (const candidate of getEmbedUrlCandidates(snippet)) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:') continue;
      const host = url.hostname.toLowerCase();

      if (provider === 'instagram' && (host === 'instagram.com' || host === 'www.instagram.com')) {
        const match = url.pathname.match(/^\/(p|reel|tv)\/([a-z0-9_-]+)\/?/i);
        if (match) return `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`;
      }

      if (provider === 'youtube' && (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com' || host === 'youtu.be')) {
        const videoId = host === 'youtu.be'
          ? url.pathname.split('/').filter(Boolean)[0]
          : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
        if (videoId && /^[a-z0-9_-]{6,20}$/i.test(videoId)) {
          return `https://www.youtube-nocookie.com/embed/${videoId}`;
        }
      }

      if (provider === 'spotify' && host === 'open.spotify.com') {
        const path = url.pathname.startsWith('/embed/') ? url.pathname : `/embed${url.pathname}`;
        if (/^\/embed\/(track|album|playlist|episode|show|artist)\/[a-z0-9]+\/?$/i.test(path)) {
          return `https://open.spotify.com${path}${url.search}`;
        }
      }

      if (provider === 'deezer' && (host === 'deezer.com' || host === 'www.deezer.com' || host === 'widget.deezer.com')) {
        if (host === 'widget.deezer.com' && url.pathname.startsWith('/widget/')) return url.toString();
        const match = url.pathname.match(/\/(track|album|playlist)\/(\d+)/i);
        if (match) return `https://widget.deezer.com/widget/auto/${match[1].toLowerCase()}/${match[2]}`;
      }

      if (provider === 'soundcloud' && (host === 'soundcloud.com' || host === 'www.soundcloud.com' || host === 'm.soundcloud.com')) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;
      }

      if (provider === 'soundcloud' && host === 'w.soundcloud.com' && url.pathname === '/player/') {
        return url.toString();
      }

      if (provider === 'vimeo' && (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com')) {
        const videoId = host === 'player.vimeo.com'
          ? url.pathname.match(/^\/video\/(\d+)/)?.[1]
          : url.pathname.match(/^\/(\d+)/)?.[1];
        if (videoId) return `https://player.vimeo.com/video/${videoId}?dnt=1`;
      }

      if (provider === 'tiktok' && (host === 'tiktok.com' || host === 'www.tiktok.com' || host === 'm.tiktok.com')) {
        const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1];
        if (videoId) return `https://www.tiktok.com/player/v1/${videoId}`;
      }

      if (provider === 'giphy' && (host === 'giphy.com' || host === 'www.giphy.com' || host === 'media.giphy.com')) {
        const embedId = url.pathname.match(/^\/embed\/([a-z0-9]+)/i)?.[1];
        const mediaId = url.pathname.match(/^\/media\/([a-z0-9]+)\//i)?.[1];
        const gifId = url.pathname.match(/-([a-z0-9]+)\/?$/i)?.[1];
        const id = embedId || mediaId || gifId;
        if (id) return `https://giphy.com/embed/${id}`;
      }

      if (provider === 'google_calendar' && host === 'calendar.google.com') {
        const match = url.pathname.match(/^\/calendar\/appointments\/schedules\/([a-z0-9_-]{20,300})\/?$/i);
        if (match) {
          const bookingUrl = new URL(`https://calendar.google.com/calendar/appointments/schedules/${match[1]}`);
          bookingUrl.searchParams.set('gv', 'true');
          return bookingUrl.toString();
        }
      }

      if (provider === 'calendly' && (host === 'calendly.com' || host === 'www.calendly.com')) {
        return url.toString();
      }

      if (provider === 'google_maps' && (host === 'www.google.com' || host === 'maps.google.com')) {
        if (url.pathname.includes('/maps/embed') || url.searchParams.get('output') === 'embed') return url.toString();
      }
    } catch {
      // Invalid provider URLs are ignored and rendered through the generic sandbox.
    }
  }
  return null;
};

export const resolveEmbedProvider = (provider?: EmbedProvider, snippet?: string): Exclude<EmbedProvider, 'auto'> => (
  provider && provider !== 'auto' ? provider : detectEmbedProvider(snippet)
);

export const getDefaultEmbedConsentCategory = (provider: Exclude<EmbedProvider, 'auto'>): EmbedConsentCategory => {
  if (provider === 'google_maps' || provider === 'google_calendar' || provider === 'calendly' || provider === 'spotify' || provider === 'deezer' || provider === 'soundcloud') return 'preferences';
  return 'marketing';
};

export const getEmbedProviderLabel = (provider: Exclude<EmbedProvider, 'auto'>) => ({
  instagram: 'Instagram',
  youtube: 'YouTube',
  spotify: 'Spotify',
  deezer: 'Deezer',
  soundcloud: 'SoundCloud',
  vimeo: 'Vimeo',
  tiktok: 'TikTok',
  giphy: 'Giphy',
  google_calendar: 'Google Calendar',
  calendly: 'Calendly',
  google_maps: 'Google Maps',
  newsletter: 'Newsletter',
  custom: 'Custom embed',
}[provider]);

export const getEmbedProviderPlaceholder = (provider: Exclude<EmbedProvider, 'auto'>): string => ({
  instagram: 'https://www.instagram.com/p/...',
  youtube: 'https://www.youtube.com/watch?v=...',
  spotify: 'https://open.spotify.com/track/...',
  deezer: 'https://www.deezer.com/track/...',
  soundcloud: 'https://soundcloud.com/artist/track',
  vimeo: 'https://vimeo.com/123456789',
  tiktok: 'https://www.tiktok.com/@creator/video/...',
  giphy: 'https://giphy.com/gifs/...',
  google_calendar: 'https://calendar.google.com/calendar/appointments/schedules/...',
  calendly: 'https://calendly.com/your-name',
  google_maps: 'https://www.google.com/maps/embed?...',
  newsletter: '<form>...</form>',
  custom: '<iframe src="https://..."></iframe>',
}[provider]);

export const getEmbedProviderDefaultHeight = (provider: Exclude<EmbedProvider, 'auto'>): number => ({
  instagram: 560,
  youtube: 360,
  spotify: 352,
  deezer: 300,
  soundcloud: 180,
  vimeo: 360,
  tiktok: 680,
  giphy: 420,
  google_calendar: 680,
  calendly: 680,
  google_maps: 360,
  newsletter: 420,
  custom: 360,
}[provider]);

export const getServiceLinkData = (content: string | null | undefined): ServiceLinkBlockData => {
  const parsed = parseBlockContent<ServiceLinkBlockData>(content);
  if (!isPlainObject(parsed)) return {};
  const service = (parsed as Record<string, unknown>).service;
  return {
    service: typeof service === 'string' && serviceLinkProviders.includes(service as ServiceLinkProvider)
      ? service as ServiceLinkProvider
      : undefined,
  };
};

export const getEmbedData = (content: string | null | undefined): EmbedBlockData => {
  const parsed = parseBlockContent<EmbedBlockData>(content);
  if (!isPlainObject(parsed)) return { provider: 'auto', consentCategory: 'marketing', height: 360, snippet: '' };
  const record = parsed as Record<string, unknown>;
  const snippet = typeof record.snippet === 'string' ? record.snippet.trim() : '';
  const provider = typeof record.provider === 'string' && embedProviders.includes(record.provider as EmbedProvider)
    ? record.provider as EmbedProvider
    : 'auto';
  const resolvedProvider = resolveEmbedProvider(provider, snippet);
  const consentCategory = typeof record.consentCategory === 'string' && embedConsentCategories.includes(record.consentCategory as EmbedConsentCategory)
    ? record.consentCategory as EmbedConsentCategory
    : getDefaultEmbedConsentCategory(resolvedProvider);
  const rawHeight = typeof record.height === 'number' ? record.height : Number(record.height);
  const height = Number.isFinite(rawHeight) ? Math.min(900, Math.max(180, Math.round(rawHeight))) : 360;
  return { snippet, provider, consentCategory, height };
};

export const getSeparatorData = (content: string | null | undefined): SeparatorBlockData => {
  const parsed = parseBlockContent<SeparatorBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  return {
    boxed: (parsed as Record<string, unknown>).boxed === true,
  };
};

export const getVideoData = (content: string | null | undefined): VideoBlockData => {
  const parsed = parseBlockContent<VideoBlockData>(content);
  if (!isPlainObject(parsed)) {
    return { controls: true, autoplay: false, loop: false, muted: true, objectFit: 'cover' };
  }
  const record = parsed as Record<string, unknown>;
  return {
    mediaUrl: toString(record.mediaUrl),
    posterUrl: toString(record.posterUrl),
    controls: record.controls !== false,
    autoplay: record.autoplay === true,
    loop: record.loop === true,
    muted: record.muted !== false,
    objectFit: record.objectFit === 'contain' ? 'contain' : 'cover',
  };
};

export const isBlockType = (type: string | undefined): type is LinkBlockType => (
  type === 'link' || type === 'menu' || type === 'text' || type === 'separator' || type === 'cta' ||
  type === 'heading' || type === 'image' || type === 'video' || type === 'contact' || type === 'social_row' ||
  type === 'callout' || type === 'map' || type === 'event' || type === 'embed'
);

export const isPublicActionableBlock = (type?: LinkBlockType | string) =>
  type !== 'separator' && type !== 'heading' && type !== 'embed' && type !== 'video';
