export type LinkBlockType = 'link' | 'text' | 'separator' | 'cta' | 'heading' | 'image' | 'contact' | 'social_row' | 'callout' | 'map' | 'event';

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
  label: string;
  url: string;
}

export interface SocialRowBlockData {
  items?: SocialRowItemData[];
}

export interface CalloutBlockData {
  badge?: string;
  buttonLabel?: string;
}

export interface MapBlockData {
  address?: string;
  placeName?: string;
  mapUrl?: string;
}

export interface EventBlockData {
  date?: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  ticketLabel?: string;
  notes?: string;
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

export const getSocialRowData = (content: string | null | undefined): SocialRowBlockData => {
  const parsed = parseBlockContent<SocialRowBlockData>(content);
  if (!isPlainObject(parsed)) return {};

  const rawItems = Array.isArray((parsed as Record<string, unknown>).items)
    ? ((parsed as Record<string, unknown>).items as unknown[])
    : [];

  const items = rawItems
    .map((entry) => (isPlainObject(entry) ? {
      label: toString(entry.label),
      url: toString(entry.url),
    } : undefined))
    .filter((item): item is SocialRowItemData => Boolean(item?.label && item?.url));

  return { items };
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
    location: toString((parsed as Record<string, unknown>).location),
    ticketLabel: toString((parsed as Record<string, unknown>).ticketLabel),
    notes: toString((parsed as Record<string, unknown>).notes),
  };
};

export const isBlockType = (type: string | undefined): type is LinkBlockType => (
  type === 'link' || type === 'text' || type === 'separator' || type === 'cta' ||
  type === 'heading' || type === 'image' || type === 'contact' || type === 'social_row' ||
  type === 'callout' || type === 'map' || type === 'event'
);

export const isPublicActionableBlock = (type?: LinkBlockType | string) =>
  type !== 'separator' && type !== 'heading';
