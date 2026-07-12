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

export interface ThemeConfig {
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
  
  fontFamily: 'Inter, system-ui, sans-serif',
  // font sizes removed from theme defaults; items will use their own saved sizes
  
  cardRadius: 12,
  cardSpacing: 12,
  maxWidth: '28rem',
  
  glowIntensity: 0.45,
  blurIntensity: 28,

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
    cardGradient: {
      ...defaultTheme.cardGradient,
      ...(themeData.cardGradient || {}),
    },
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

const getReadableForeground = (background: string, fallback: string) => {
  const normalized = background.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? "#172033" : "#f8fafc";
};

export const getThemeCssVariables = (theme: ThemeConfig): Record<string, string> => {
  const cardHsl = hexToHsl(theme.card);
  const borderHsl = hexToHsl(theme.border);
  const primaryGlowHsl = hexToHsl(theme.primaryGlow);
  const primaryForegroundHsl = hexToHsl(getReadableForeground(theme.primary, theme.foreground));
  const tint = (theme as any).cardBlurTint || theme.card;

  return {
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
    '--card-glow': `0 8px ${theme.blurIntensity}px hsl(${primaryGlowHsl} / ${Math.min(0.9, theme.glowIntensity)})`,
    '--glass-tint': tint,
  };
};

// Apply theme for public view (affects the entire page)
export const applyTheme = (theme: ThemeConfig) => {
  const root = document.documentElement;
  const variables = getThemeCssVariables(theme);

  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  document.body.style.fontFamily = theme.fontFamily;

  const bgType = theme.backgroundMedia?.type;
  if (bgType === 'video' || bgType === 'gif') {
    // The BackgroundLayer component (z-index:-1) handles the visual.
    // Body must be transparent so the fixed video shows through.
    // <html> carries the dark fallback while the media loads.
    root.style.setProperty('--gradient-background', 'transparent');
    document.documentElement.style.background = theme.background;
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
  } else {
    document.documentElement.style.background = '';
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
  const root = document.documentElement;
  
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
  document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
  
  // Apply admin layout
  root.style.setProperty('--radius', '12px');
  root.style.setProperty('--blur-intensity', '20px');
  root.style.setProperty('--card-spacing', '12px');
  
  // Update glass card background
  root.style.setProperty('--glass-bg', `hsl(${hexToHsl(adminTheme.card)} / 0.8)`);
  root.style.setProperty('--glass-border', `1px solid hsl(${hexToHsl(adminTheme.border)} / 0.5)`);
  
  // Force body background update for admin
  document.body.style.background = `linear-gradient(${adminTheme.backgroundGradient.direction}, ${adminTheme.backgroundGradient.from}, ${adminTheme.backgroundGradient.to})`;
};
