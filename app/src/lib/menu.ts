export type MenuVenueType = 'restaurant' | 'bar' | 'cafe';
export type MenuThemePreset = 'editorial' | 'bistro' | 'espresso' | 'coastal';

export interface MenuVariant {
  id: string;
  name: string;
  priceMinor: number;
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string;
  visible: boolean;
  position: number;
}

export interface MenuItem {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  priceMinor: number;
  details?: string;
  imageUrl?: string;
  imageAlt?: string;
  variants: MenuVariant[];
  allergens: string[];
  dietaryTags: string[];
  available: boolean;
  featured: boolean;
  position: number;
}

export interface MenuTheme {
  preset: MenuThemePreset;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  radius: number;
  imageLayout: 'compact' | 'cover';
}

export interface MenuCatalog {
  version: 1;
  enabled: boolean;
  venueType: MenuVenueType;
  name: string;
  description: string;
  currency: string;
  locale: string;
  sections: MenuSection[];
  items: MenuItem[];
  theme: MenuTheme;
  updatedAt?: string;
}

export const MENU_THEME_PRESETS: Record<MenuThemePreset, MenuTheme> = {
  editorial: {
    preset: 'editorial', background: '#f4f1eb', surface: '#fffdf8', text: '#17201d', muted: '#66706b',
    accent: '#1f5b47', border: '#d7d4cc', radius: 8, imageLayout: 'compact',
  },
  bistro: {
    preset: 'bistro', background: '#f6eee7', surface: '#fffaf5', text: '#291a17', muted: '#745f58',
    accent: '#a43d2f', border: '#dfcfc3', radius: 4, imageLayout: 'cover',
  },
  espresso: {
    preset: 'espresso', background: '#171713', surface: '#24231d', text: '#f5f0e4', muted: '#b7ad9b',
    accent: '#d5a95f', border: '#454138', radius: 10, imageLayout: 'compact',
  },
  coastal: {
    preset: 'coastal', background: '#edf4f2', surface: '#fbfdfc', text: '#142b2c', muted: '#587072',
    accent: '#176f78', border: '#c8d9d6', radius: 12, imageLayout: 'cover',
  },
};

const DEFAULT_SECTIONS: Record<MenuVenueType, Array<Pick<MenuSection, 'name' | 'description'>>> = {
  restaurant: [
    { name: 'Starters', description: 'Small plates and seasonal openings' },
    { name: 'Main courses', description: 'From the kitchen' },
    { name: 'Desserts', description: 'A final course' },
  ],
  bar: [
    { name: 'Signature drinks', description: 'House creations' },
    { name: 'Classics', description: 'The essential selection' },
    { name: 'Alcohol free', description: 'Zero-proof drinks and softs' },
  ],
  cafe: [
    { name: 'Coffee', description: 'Espresso bar' },
    { name: 'Breakfast', description: 'Fresh every morning' },
    { name: 'Cold drinks', description: 'Refreshments and juices' },
  ],
};

function safeId(value: unknown, fallback: string) {
  const normalized = typeof value === 'string' ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) : '';
  return normalized || fallback;
}

function text(value: unknown, max: number, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function price(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000_000 ? parsed : 0;
}

function list(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => text(entry, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function passiveMediaUrl(value: unknown) {
  const url = text(value, 2048);
  if (!url) return '';
  if (/^(?:https?:\/\/|\/api\/|\/media\/|\/uploads\/)/i.test(url)) return url;
  return '';
}

export function createDefaultMenu(venueType: MenuVenueType = 'restaurant'): MenuCatalog {
  const sections = DEFAULT_SECTIONS[venueType].map((section, index) => ({
    id: `section-${index + 1}`,
    ...section,
    visible: true,
    position: index,
  }));
  const preset: MenuThemePreset = venueType === 'bar' ? 'espresso' : venueType === 'cafe' ? 'coastal' : 'editorial';
  return {
    version: 1,
    enabled: false,
    venueType,
    name: venueType === 'restaurant' ? 'Our menu' : venueType === 'bar' ? 'Drinks menu' : 'Café menu',
    description: 'A concise selection, updated by the venue.',
    currency: 'EUR',
    locale: 'en-GB',
    sections,
    items: [],
    theme: { ...MENU_THEME_PRESETS[preset] },
  };
}

export function normalizeMenuCatalog(value: unknown, maxItems = 250): MenuCatalog {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const venueType: MenuVenueType = input.venueType === 'bar' || input.venueType === 'cafe' ? input.venueType : 'restaurant';
  const fallback = createDefaultMenu(venueType);
  const rawSections = Array.isArray(input.sections) ? input.sections : fallback.sections;
  const sections = rawSections.slice(0, 30).map((entry, index) => {
    const section = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    return {
      id: safeId(section.id, `section-${index + 1}`),
      name: text(section.name, 80, `Section ${index + 1}`),
      description: text(section.description, 240) || undefined,
      visible: section.visible !== false,
      position: index,
    };
  });
  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sections[0]?.id || 'section-1';
  if (sections.length === 0) sections.push({ id: fallbackSectionId, name: 'Menu', visible: true, position: 0 });

  const items = (Array.isArray(input.items) ? input.items : []).slice(0, maxItems).map((entry, index) => {
    const item = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    const rawVariants = Array.isArray(item.variants) ? item.variants : [];
    const variants = rawVariants.slice(0, 8).map((entryVariant, variantIndex) => {
      const variant = entryVariant && typeof entryVariant === 'object' && !Array.isArray(entryVariant)
        ? entryVariant as Record<string, unknown> : {};
      return {
        id: safeId(variant.id, `variant-${variantIndex + 1}`),
        name: text(variant.name, 60, `Option ${variantIndex + 1}`),
        priceMinor: price(variant.priceMinor),
      };
    });
    const requestedSectionId = safeId(item.sectionId, fallbackSectionId);
    return {
      id: safeId(item.id, `item-${index + 1}`),
      sectionId: sectionIds.has(requestedSectionId) ? requestedSectionId : fallbackSectionId,
      name: text(item.name, 120, `Item ${index + 1}`),
      description: text(item.description, 500) || undefined,
      priceMinor: price(item.priceMinor),
      details: text(item.details, 100) || undefined,
      imageUrl: passiveMediaUrl(item.imageUrl) || undefined,
      imageAlt: text(item.imageAlt, 160) || undefined,
      variants,
      allergens: list(item.allergens, 20, 40),
      dietaryTags: list(item.dietaryTags, 12, 40),
      available: item.available !== false,
      featured: item.featured === true,
      position: index,
    };
  });

  const rawTheme = input.theme && typeof input.theme === 'object' && !Array.isArray(input.theme)
    ? input.theme as Record<string, unknown> : {};
  const preset = Object.prototype.hasOwnProperty.call(MENU_THEME_PRESETS, rawTheme.preset)
    ? rawTheme.preset as MenuThemePreset : fallback.theme.preset;
  const presetTheme = MENU_THEME_PRESETS[preset];
  return {
    version: 1,
    enabled: input.enabled === true,
    venueType,
    name: text(input.name, 120, fallback.name),
    description: text(input.description, 500, fallback.description),
    currency: /^[A-Z]{3}$/.test(text(input.currency, 3)) ? text(input.currency, 3) : 'EUR',
    locale: /^[a-z]{2}(?:-[A-Z]{2})?$/.test(text(input.locale, 8)) ? text(input.locale, 8) : 'en-GB',
    sections,
    items,
    theme: {
      preset,
      background: color(rawTheme.background, presetTheme.background),
      surface: color(rawTheme.surface, presetTheme.surface),
      text: color(rawTheme.text, presetTheme.text),
      muted: color(rawTheme.muted, presetTheme.muted),
      accent: color(rawTheme.accent, presetTheme.accent),
      border: color(rawTheme.border, presetTheme.border),
      radius: Math.max(0, Math.min(28, Number.isFinite(Number(rawTheme.radius)) ? Math.round(Number(rawTheme.radius)) : presetTheme.radius)),
      imageLayout: rawTheme.imageLayout === 'cover' ? 'cover' : 'compact',
    },
    updatedAt: text(input.updatedAt, 40) || undefined,
  };
}

export function formatMenuPrice(priceMinor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(priceMinor / 100);
}
