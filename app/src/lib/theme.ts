import { getHostedThemeRoot, isIntegratedHostedSurface } from './hosted-surface';

export interface BackgroundMediaConfig {
  type: 'color' | 'gradient' | 'video' | 'gif';
  mediaUrl?: string;
  opacity: number;
  blur: number;
  overlayColor: string;
  overlayOpacity: number;
  brightness: number;
  saturation: number;
  contrast: number;
  scale: number;
  objectFit: 'cover' | 'contain' | 'fill';
  glassmorphism: boolean;
}

export const defaultBackgroundMedia: BackgroundMediaConfig = {
  type: 'gradient',
  mediaUrl: undefined,
  opacity: 1,
  blur: 0,
  overlayColor: '#000000',
  overlayOpacity: 0,
  brightness: 1,
  saturation: 1,
  contrast: 1,
  scale: 1,
  objectFit: 'cover',
  glassmorphism: false,
};

export interface CardShadowConfig {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  opacity: number;
}

export type CardSurfaceEffect = 'solid' | 'transparent' | 'liquid-glass';

export const defaultCardShadow: CardShadowConfig = {
  color: '#07111f',
  offsetX: 0,
  offsetY: 14,
  blur: 36,
  spread: -12,
  opacity: 0.28,
};

export interface ThemeConfig {
  orbitPageAccess?: {
    mode: 'preset' | 'custom';
    presetId?: string | null;
    cardPresetId?: string | null;
  };
  // Colors
  primary: string;
  primaryGlow: string;
  background: string;
  backgroundSecondary: string;
  card: string;
  foreground: string;
  muted: string;
  accent: string;
  border: string;

  // Gradients
  backgroundGradient: {
    from: string;
    to: string;
    direction: string;
  };
  cardGradient: {
    from: string;
    to: string;
    direction: string;
  };
  profileCard: {
    background: string;
    backgroundSecondary: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
    direction: string;
  };
  contentCard: {
    background: string;
    backgroundSecondary: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
    accentForeground: string;
    direction: string;
  };
  contentCardMode: 'mono' | 'multi';
  contentCardVariants: ThemeConfig['contentCard'][];
  profileCardOpacity: number;
  contentCardOpacity: number;
  profileCardEffect: CardSurfaceEffect;
  contentCardEffect: CardSurfaceEffect;

  // Typography
  fontFamily: string;
  // Note: per-item font sizes are handled on profile and link objects; theme no longer stores font sizes

  // Layout
  cardRadius: number;
  cardSpacing: number;
  maxWidth: string;

  // Effects
  glowIntensity: number;
  blurIntensity: number;
  cardShadow: CardShadowConfig;

  // Background Media (video / gif / color / gradient)
  backgroundMedia: BackgroundMediaConfig;

  // Content
  content: {
    profileName: string;
    profileBio: string;
    footerText: string;
    adminTitle: string;
  };
}

export const defaultTheme: ThemeConfig = {
  orbitPageAccess: {
    mode: 'preset',
    presetId: 'default',
    cardPresetId: null,
  },
  primary: '#2f81f7',
  primaryGlow: '#58a6ff',
  background: '#0d1117',
  backgroundSecondary: '#161b22',
  card: '#1c2433',
  foreground: '#e6edf3',
  muted: '#8b949e',
  accent: '#1f6feb',
  border: '#21262d',

  backgroundGradient: {
    from: '#0d1117',
    to: '#111827',
    direction: '135deg'
  },
  cardGradient: {
    from: '#1c2433',
    to: '#21303f',
    direction: '135deg'
  },
  profileCard: {
    background: '#1c2433',
    backgroundSecondary: '#21303f',
    foreground: '#e6edf3',
    muted: '#8b949e',
    border: '#21262d',
    accent: '#2f81f7',
    direction: '135deg',
  },
  contentCard: {
    background: '#1c2433',
    backgroundSecondary: '#21303f',
    foreground: '#e6edf3',
    muted: '#8b949e',
    border: '#21262d',
    accent: '#2f81f7',
    accentForeground: '#f8fafc',
    direction: '135deg',
  },
  contentCardMode: 'mono',
  contentCardVariants: [],
  profileCardOpacity: 1,
  contentCardOpacity: 1,
  profileCardEffect: 'solid',
  contentCardEffect: 'solid',
  
  fontFamily: 'Inter, system-ui, sans-serif',
  // font sizes removed from theme defaults; items will use their own saved sizes
  
  cardRadius: 12,
  cardSpacing: 12,
  maxWidth: '28rem',
  
  glowIntensity: 0.45,
  blurIntensity: 28,
  cardShadow: defaultCardShadow,

  backgroundMedia: defaultBackgroundMedia,

  content: {
    // Keep content fields empty by default to avoid showing mock data before real values load
    profileName: '',
    profileBio: '',
    footerText: '',
    adminTitle: 'Link Manager Admin'
  }
};

export const normalizeTheme = (themeData?: Record<string, any> | null): ThemeConfig => {
  if (!themeData) return defaultTheme;

  const legacyColors: Partial<ThemeConfig> = {};
  const primary = themeData.primary ?? themeData.primaryColor;
  const background = themeData.background ?? themeData.backgroundColor;
  const foreground = themeData.foreground ?? themeData.textColor;

  if (primary) legacyColors.primary = primary;
  if (background) legacyColors.background = background;
  if (foreground) legacyColors.foreground = foreground;

  const legacyCard = themeData.card || background || defaultTheme.card;
  const legacyCardGradient = themeData.cardGradient
    ? {
        ...defaultTheme.cardGradient,
        ...themeData.cardGradient,
      }
    : {
        from: legacyCard,
        to: themeData.backgroundSecondary || legacyCard,
        direction: defaultTheme.cardGradient.direction,
      };
  const normalizedContentCard = {
    background: legacyCard,
    backgroundSecondary: legacyCardGradient.to,
    foreground: foreground || defaultTheme.foreground,
    muted: themeData.muted || defaultTheme.muted,
    border: themeData.border || defaultTheme.border,
    accent: primary || defaultTheme.primary,
    accentForeground: getReadableForeground(primary || defaultTheme.primary, foreground || defaultTheme.foreground),
    direction: legacyCardGradient.direction,
    ...(themeData.contentCard || {}),
  };
  const normalizedContentCardVariants = Array.isArray(themeData.contentCardVariants)
    ? themeData.contentCardVariants.slice(0, 8).map((variant: Partial<ThemeConfig['contentCard']>) => ({
        ...normalizedContentCard,
        ...variant,
      }))
    : [];

  return {
    ...defaultTheme,
    ...themeData,
    ...legacyColors,
    backgroundGradient: themeData.backgroundGradient
      ? {
          ...defaultTheme.backgroundGradient,
          ...themeData.backgroundGradient,
        }
      : {
          ...defaultTheme.backgroundGradient,
          from: background || defaultTheme.backgroundGradient.from,
          to: background || defaultTheme.backgroundGradient.to,
        },
    cardGradient: legacyCardGradient,
    profileCard: {
      background: legacyCard,
      backgroundSecondary: legacyCardGradient.to,
      foreground: foreground || defaultTheme.foreground,
      muted: themeData.muted || defaultTheme.muted,
      border: themeData.border || defaultTheme.border,
      accent: primary || defaultTheme.primary,
      direction: legacyCardGradient.direction,
      ...(themeData.profileCard || {}),
    },
    contentCard: normalizedContentCard,
    contentCardMode: themeData.contentCardMode === 'multi' ? 'multi' : 'mono',
    contentCardVariants: normalizedContentCardVariants.length ? normalizedContentCardVariants : [normalizedContentCard],
    profileCardOpacity: clampNumber(themeData.profileCardOpacity, defaultTheme.profileCardOpacity, 0, 1),
    contentCardOpacity: clampNumber(themeData.contentCardOpacity, defaultTheme.contentCardOpacity, 0, 1),
    profileCardEffect: normalizeCardSurfaceEffect(themeData.profileCardEffect),
    contentCardEffect: normalizeCardSurfaceEffect(themeData.contentCardEffect),
    cardShadow: normalizeCardShadow(themeData.cardShadow, {
      color: themeData.primaryGlow || defaultCardShadow.color,
      offsetX: 0,
      offsetY: 8,
      blur: themeData.blurIntensity ?? defaultCardShadow.blur,
      spread: 0,
      opacity: Math.min(0.9, themeData.glowIntensity ?? defaultCardShadow.opacity),
    }),
    backgroundMedia: {
      ...defaultBackgroundMedia,
      ...(themeData.backgroundMedia || {}),
    },
    content: {
      ...defaultTheme.content,
      ...(themeData.content || {}),
    },
  };
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export const normalizeCardSurfaceEffect = (value: unknown): CardSurfaceEffect => (
  value === 'transparent' || value === 'liquid-glass' ? value : 'solid'
);

const normalizeHexColor = (value: unknown, fallback: string) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
);

export const normalizeCardShadow = (
  shadow?: Partial<CardShadowConfig> | null,
  fallback: Partial<CardShadowConfig> = defaultCardShadow,
): CardShadowConfig => {
  const base = { ...defaultCardShadow, ...fallback };
  return {
    color: normalizeHexColor(shadow?.color, base.color),
    offsetX: clampNumber(shadow?.offsetX, base.offsetX, -32, 32),
    offsetY: clampNumber(shadow?.offsetY, base.offsetY, -32, 48),
    blur: clampNumber(shadow?.blur, base.blur, 0, 96),
    spread: clampNumber(shadow?.spread, base.spread, -32, 48),
    opacity: clampNumber(shadow?.opacity, base.opacity, 0, 1),
  };
};

export const getCardShadowCss = (shadow: CardShadowConfig): string => {
  const normalized = normalizeCardShadow(shadow);
  const hex = normalized.color.slice(1);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `${normalized.offsetX}px ${normalized.offsetY}px ${normalized.blur}px ${normalized.spread}px rgba(${red}, ${green}, ${blue}, ${normalized.opacity})`;
};

const withOpacity = (color: string, opacity: number) => {
  const normalized = color.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return `color-mix(in srgb, ${color} ${Math.round(opacity * 10000) / 100}%, transparent)`;
  }
  const channels = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity})`;
};

export const getCardSurfaceGradient = (
  surface: Pick<ThemeConfig['contentCard'], 'background' | 'backgroundSecondary' | 'direction'>,
  opacity = 1,
) => {
  const normalizedOpacity = clampNumber(opacity, 1, 0, 1);
  return `linear-gradient(${surface.direction}, ${withOpacity(surface.background, normalizedOpacity)}, ${withOpacity(surface.backgroundSecondary, normalizedOpacity)})`;
};

// Convert hex to HSL for CSS variables
const hexToHsl = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h, s;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const getRelativeLuminance = (color: string) => {
  const normalized = color.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const getContrastRatio = (first: string, second: string) => {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) return 1;
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableForeground = (background: string, fallback: string) => {
  const normalized = background.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback;
  return [fallback, '#05070a', '#ffffff'].reduce((best, candidate) => (
    getContrastRatio(background, candidate) > getContrastRatio(background, best) ? candidate : best
  ));
};

const mixHexColors = (from: string, to: string, amount: number) => {
  const parse = (value: string) => {
    const normalized = value.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const fromChannels = parse(from);
  const toChannels = parse(to);
  if (!fromChannels || !toChannels) return to;
  const mixed = fromChannels.map((channel, index) => Math.round(channel + (toChannels[index] - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

export const ensureReadableColor = (
  preferred: string,
  backgrounds: string[],
  fallback: string,
  minimumContrast = 4.5,
) => {
  const isReadable = (color: string) => backgrounds.every((background) => getContrastRatio(color, background) >= minimumContrast);
  if (isReadable(preferred)) return preferred;

  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexColors(preferred, fallback, step / 20);
    if (isReadable(candidate)) return candidate;
  }

  return [fallback, '#05070a', '#ffffff'].reduce((best, candidate) => {
    const weakestContrast = Math.min(...backgrounds.map((background) => getContrastRatio(candidate, background)));
    const bestWeakestContrast = Math.min(...backgrounds.map((background) => getContrastRatio(best, background)));
    return weakestContrast > bestWeakestContrast ? candidate : best;
  });
};

export const getThemeCssVariables = (theme: ThemeConfig): Record<string, string> => {
  const profileCardOpacity = clampNumber(theme.profileCardOpacity, defaultTheme.profileCardOpacity, 0, 1);
  const contentCardOpacity = clampNumber(theme.contentCardOpacity, defaultTheme.contentCardOpacity, 0, 1);
  const cardHsl = hexToHsl(theme.card);
  const borderHsl = hexToHsl(theme.border);
  const primaryGlowHsl = hexToHsl(theme.primaryGlow);
  const primaryForegroundHsl = hexToHsl(getReadableForeground(theme.primary, theme.foreground));
  const tint = (theme as any).cardBlurTint || theme.card;
  const profileAccentForeground = getReadableForeground(theme.profileCard.accent, theme.profileCard.foreground);
  const contentAccentForeground = theme.contentCard.accentForeground || getReadableForeground(theme.contentCard.accent, theme.contentCard.foreground);
  const contentCardVariants = theme.contentCardMode === 'multi' && theme.contentCardVariants.length
    ? theme.contentCardVariants
    : [theme.contentCard];

  return {
    ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
      const variant = contentCardVariants[index % contentCardVariants.length] || theme.contentCard;
      const prefix = `--content-card-v${index}`;
      const accentForeground = variant.accentForeground || getReadableForeground(variant.accent, variant.foreground);
      return [
        [`${prefix}-background`, getCardSurfaceGradient(variant, contentCardOpacity)],
        [`${prefix}-background-hsl`, hexToHsl(variant.background)],
        [`${prefix}-secondary-hsl`, hexToHsl(variant.backgroundSecondary)],
        [`${prefix}-foreground`, variant.foreground],
        [`${prefix}-foreground-hsl`, hexToHsl(variant.foreground)],
        [`${prefix}-muted`, variant.muted],
        [`${prefix}-muted-hsl`, hexToHsl(variant.muted)],
        [`${prefix}-border`, variant.border],
        [`${prefix}-border-hsl`, hexToHsl(variant.border)],
        [`${prefix}-accent`, variant.accent],
        [`${prefix}-accent-hsl`, hexToHsl(variant.accent)],
        [`${prefix}-accent-foreground`, accentForeground],
        [`${prefix}-accent-foreground-hsl`, hexToHsl(accentForeground)],
      ];
    }).flat()),
    '--primary': hexToHsl(theme.primary),
    '--primary-glow': primaryGlowHsl,
    '--primary-foreground': primaryForegroundHsl,
    '--background': hexToHsl(theme.background),
    '--card': cardHsl,
    '--card-foreground': hexToHsl(theme.foreground),
    '--foreground': hexToHsl(theme.foreground),
    '--muted': hexToHsl(theme.backgroundSecondary),
    '--muted-foreground': hexToHsl(theme.muted),
    '--accent': hexToHsl(theme.primary),
    '--accent-foreground': primaryForegroundHsl,
    '--border': borderHsl,
    '--input': hexToHsl(theme.backgroundSecondary),
    '--ring': hexToHsl(theme.primary),
    '--popover': cardHsl,
    '--popover-foreground': hexToHsl(theme.foreground),
    '--secondary': hexToHsl(theme.backgroundSecondary),
    '--secondary-foreground': hexToHsl(theme.foreground),
    '--gradient-background': `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`,
    '--gradient-card': `linear-gradient(${theme.cardGradient.direction}, ${theme.cardGradient.from}, ${theme.cardGradient.to})`,
    '--gradient-primary': `linear-gradient(135deg, ${theme.primary}, ${theme.primaryGlow})`,
    '--font-family': theme.fontFamily,
    '--line-height-normal': '1.45',
    '--line-height-tight': '1.25',
    '--radius': `${theme.cardRadius}px`,
    '--blur-intensity': `${theme.blurIntensity}px`,
    '--card-spacing': `${theme.cardSpacing}px`,
    '--glass-bg': `hsl(${cardHsl} / 0.78)`,
    '--glass-border': `1px solid hsl(${borderHsl} / 0.5)`,
    '--card-glow': getCardShadowCss(theme.cardShadow),
    '--glass-tint': tint,
    '--profile-card-surface-tint': theme.profileCard.background,
    '--content-card-surface-tint': theme.contentCard.background,
    '--profile-card-opacity-percent': `${Math.round(profileCardOpacity * 10000) / 100}%`,
    '--content-card-opacity-percent': `${Math.round(contentCardOpacity * 10000) / 100}%`,
    '--profile-card-background': getCardSurfaceGradient(theme.profileCard, profileCardOpacity),
    '--profile-card-foreground': theme.profileCard.foreground,
    '--profile-card-muted': theme.profileCard.muted,
    '--profile-card-border': theme.profileCard.border,
    '--profile-card-accent': theme.profileCard.accent,
    '--profile-card-accent-foreground': profileAccentForeground,
    '--content-card-background': getCardSurfaceGradient(theme.contentCard, contentCardOpacity),
    '--content-card-background-hsl': hexToHsl(theme.contentCard.background),
    '--content-card-secondary-hsl': hexToHsl(theme.contentCard.backgroundSecondary),
    '--content-card-foreground': theme.contentCard.foreground,
    '--content-card-foreground-hsl': hexToHsl(theme.contentCard.foreground),
    '--content-card-muted': theme.contentCard.muted,
    '--content-card-muted-hsl': hexToHsl(theme.contentCard.muted),
    '--content-card-border': theme.contentCard.border,
    '--content-card-border-hsl': hexToHsl(theme.contentCard.border),
    '--content-card-accent': theme.contentCard.accent,
    '--content-card-accent-hsl': hexToHsl(theme.contentCard.accent),
    '--content-card-accent-foreground': contentAccentForeground,
    '--content-card-accent-foreground-hsl': hexToHsl(contentAccentForeground),
  };
};

export const getContentCardVariant = (theme: ThemeConfig, index: number): ThemeConfig['contentCard'] => {
  const variants = theme.contentCardMode === 'multi' && theme.contentCardVariants.length
    ? theme.contentCardVariants
    : [theme.contentCard];
  return variants[index % variants.length] || theme.contentCard;
};

export const getContentCardVariantCssVariables = (theme: ThemeConfig, index: number): Record<string, string> => {
  const variant = getContentCardVariant(theme, index);
  const accentForeground = variant.accentForeground || getReadableForeground(variant.accent, variant.foreground);

  return {
    '--content-card-background': getCardSurfaceGradient(variant, theme.contentCardOpacity),
    '--content-card-background-hsl': hexToHsl(variant.background),
    '--content-card-secondary-hsl': hexToHsl(variant.backgroundSecondary),
    '--content-card-foreground': variant.foreground,
    '--content-card-foreground-hsl': hexToHsl(variant.foreground),
    '--content-card-muted': variant.muted,
    '--content-card-muted-hsl': hexToHsl(variant.muted),
    '--content-card-border': variant.border,
    '--content-card-border-hsl': hexToHsl(variant.border),
    '--content-card-accent': variant.accent,
    '--content-card-accent-hsl': hexToHsl(variant.accent),
    '--content-card-accent-foreground': accentForeground,
    '--content-card-accent-foreground-hsl': hexToHsl(accentForeground),
  };
};

// Apply theme for public view (affects the entire page)
export const applyTheme = (theme: ThemeConfig) => {
  const root = getHostedThemeRoot();
  const integrated = isIntegratedHostedSurface();
  const variables = getThemeCssVariables(theme);

  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  if (integrated) {
    root.style.setProperty('--glassmorphism', theme.backgroundMedia?.glassmorphism ? '1' : '0');
    return;
  }

  document.body.style.fontFamily = theme.fontFamily;

  const bgType = theme.backgroundMedia?.type;
  if (bgType === 'video' || bgType === 'gif') {
    // The BackgroundLayer component (z-index:-1) handles the visual.
    // Body must be transparent so the fixed video shows through.
    // <html> carries the dark fallback while the media loads.
    root.style.setProperty('--gradient-background', 'transparent');
    root.style.background = theme.background;
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
  } else {
    root.style.background = '';
    document.body.style.backgroundColor = '';
    if (bgType === 'color') {
      document.body.style.background = theme.background;
    } else {
      document.body.style.background = `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`;
    }
  }

  // Glassmorphism: expose as CSS variable for card overrides
  root.style.setProperty('--glassmorphism', theme.backgroundMedia?.glassmorphism ? '1' : '0');
};

// Apply admin theme (maintains consistent admin styling)
export const applyAdminTheme = () => {
  const root = getHostedThemeRoot();
  const integrated = isIntegratedHostedSurface();
  
  // Consistent admin theme — dark slate + electric blue
  const adminTheme = {
    primary: '#2f81f7',
    primaryGlow: '#58a6ff',
    background: '#0d1117',
    backgroundSecondary: '#161b22',
    card: '#1c2433',
    foreground: '#e6edf3',
    muted: '#8b949e',
    accent: '#1f6feb',
    border: '#21262d',
    backgroundGradient: {
      from: '#0d1117',
      to: '#111827',
      direction: '135deg'
    }
  };
  
  // Apply admin-specific styling
  root.style.setProperty('--primary', hexToHsl(adminTheme.primary));
  root.style.setProperty('--primary-glow', hexToHsl(adminTheme.primaryGlow));
  root.style.setProperty('--primary-foreground', hexToHsl(adminTheme.foreground));
  root.style.setProperty('--background', hexToHsl(adminTheme.background));
  root.style.setProperty('--card', hexToHsl(adminTheme.card));
  root.style.setProperty('--card-foreground', hexToHsl(adminTheme.foreground));
  root.style.setProperty('--foreground', hexToHsl(adminTheme.foreground));
  root.style.setProperty('--muted', hexToHsl(adminTheme.backgroundSecondary));
  root.style.setProperty('--muted-foreground', hexToHsl(adminTheme.muted));
  // Accent mirrors primary in admin theme
  root.style.setProperty('--accent', hexToHsl(adminTheme.primary));
  root.style.setProperty('--accent-foreground', hexToHsl(adminTheme.foreground));
  root.style.setProperty('--border', hexToHsl(adminTheme.border));
  root.style.setProperty('--input', hexToHsl(adminTheme.backgroundSecondary));
  root.style.setProperty('--ring', hexToHsl(adminTheme.primary));
  root.style.setProperty('--popover', hexToHsl(adminTheme.card));
  root.style.setProperty('--popover-foreground', hexToHsl(adminTheme.foreground));
  root.style.setProperty('--secondary', hexToHsl(adminTheme.backgroundSecondary));
  root.style.setProperty('--secondary-foreground', hexToHsl(adminTheme.foreground));
  
  // Apply admin gradients
  root.style.setProperty('--gradient-background', 
    `linear-gradient(${adminTheme.backgroundGradient.direction}, ${adminTheme.backgroundGradient.from}, ${adminTheme.backgroundGradient.to})`);
  root.style.setProperty('--gradient-card', 
    `linear-gradient(135deg, ${adminTheme.card}, #1e293b)`);
  root.style.setProperty('--gradient-primary', 
    `linear-gradient(135deg, ${adminTheme.primary}, ${adminTheme.primaryGlow})`);
  
  // Apply admin typography
  root.style.setProperty('--font-family', 'Inter, system-ui, sans-serif');
  (integrated ? root : document.body).style.fontFamily = 'Inter, system-ui, sans-serif';
  
  // Apply admin layout
  root.style.setProperty('--radius', '12px');
  root.style.setProperty('--blur-intensity', '20px');
  root.style.setProperty('--card-spacing', '12px');
  
  // Update glass card background
  root.style.setProperty('--glass-bg', `hsl(${hexToHsl(adminTheme.card)} / 0.8)`);
  root.style.setProperty('--glass-border', `1px solid hsl(${hexToHsl(adminTheme.border)} / 0.5)`);
  
  // Force body background update for admin
  (integrated ? root : document.body).style.background = `linear-gradient(${adminTheme.backgroundGradient.direction}, ${adminTheme.backgroundGradient.from}, ${adminTheme.backgroundGradient.to})`;
};
