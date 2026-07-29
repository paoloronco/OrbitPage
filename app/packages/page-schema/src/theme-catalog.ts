import {
  DEFAULT_ORBITPAGE_THEME,
  type OrbitPageTheme
} from "./theme";

type ThemeRow = readonly [
  id: string,
  primary: string,
  primaryGlow: string,
  background: string,
  backgroundSecondary: string,
  card: string,
  foreground: string,
  muted: string,
  border: string,
  gradientTo: string,
  cardGradientTo: string,
  fontFamily: string,
  cardRadius: number,
  cardSpacing: number,
  glowIntensity: number,
  blurIntensity: number,
  maxWidth?: string,
  cardShadow?: Partial<OrbitPageTheme["cardShadow"]>
];

const PAGE_THEME_ROWS: readonly ThemeRow[] = [
  ["midnight-signal", "#4f8cff", "#78b7ff", "#07111f", "#101e31", "#14253b", "#edf5ff", "#9db0c8", "#29415f", "#11284a", "#1a3150", "Poppins, system-ui, sans-serif", 18, 14, 0.42, 24],
  ["paper-ink", "#b44b2a", "#d47751", "#f3ede2", "#e8dfd0", "#fffaf0", "#28231e", "#756b60", "#d3c5b2", "#e4d7c5", "#f6ecdc", "Georgia, serif", 6, 16, 0.08, 10, "32rem"],
  ["terracotta-studio", "#d55f3e", "#ef9870", "#2c1e19", "#453029", "#52372e", "#fff2e7", "#d8b8a6", "#714b3d", "#61382a", "#674237", "Lato, system-ui, sans-serif", 22, 12, 0.28, 18],
  ["nordic-moss", "#6e9b72", "#a2c59d", "#17211b", "#243128", "#2a392e", "#edf3e9", "#aab9a7", "#415346", "#2e4032", "#344638", "Montserrat, system-ui, sans-serif", 14, 18, 0.18, 20],
  ["coral-hour", "#e94f58", "#ff9077", "#fff1e8", "#f9d8ca", "#fff9f3", "#3c2022", "#91676a", "#edb8aa", "#ffc5b0", "#ffe6da", "Poppins, system-ui, sans-serif", 24, 12, 0.2, 18],
  ["acid-editorial", "#c7f43d", "#e0ff79", "#161814", "#232620", "#292d25", "#f4f7eb", "#afb7a3", "#444a3d", "#292f1c", "#343a2c", "Montserrat, system-ui, sans-serif", 4, 9, 0.16, 8, "32rem"],
  ["coastal-glass", "#167d91", "#5fc3cb", "#dff1ef", "#c3e2df", "#f2fbf9", "#173a40", "#55777b", "#9ccbc7", "#a9d8dc", "#d9f2ef", "Lato, system-ui, sans-serif", 20, 15, 0.24, 32],
  ["cherry-noir", "#e44863", "#ff7b8e", "#150b10", "#28141d", "#321923", "#fff0f3", "#c19aa6", "#563040", "#3f1726", "#43212d", "Playfair Display, Georgia, serif", 12, 17, 0.3, 20],
  ["sandstone", "#6f7744", "#9ca467", "#e9e0cf", "#d9cdb8", "#f5eddf", "#37352b", "#75705f", "#c7b99f", "#cfc1a8", "#e6dac6", "Georgia, serif", 10, 20, 0.05, 12, "32rem"],
  ["cobalt-poster", "#f04b36", "#ff846f", "#163d9f", "#2450b9", "#244aa8", "#fff8e8", "#c9d5fa", "#7892df", "#0c2b78", "#183b92", "Montserrat, system-ui, sans-serif", 2, 10, 0.12, 6, "32rem"],
  ["soft-lilac", "#76529d", "#a77bc5", "#eee7f0", "#ded1e3", "#faf5fb", "#33253a", "#76657d", "#cbb9d1", "#d7c4df", "#eee2f1", "Poppins, system-ui, sans-serif", 18, 14, 0.16, 22],
  ["mono-redline", "#d83232", "#f06455", "#ececea", "#dcdcd8", "#f8f8f4", "#20201e", "#686864", "#c5c5bf", "#d3d3ce", "#eeeeea", "Lato, system-ui, sans-serif", 8, 12, 0.04, 8],
  ["arctic-ledger", "#315fd6", "#6f91e6", "#e8eef5", "#d7e0eb", "#f8fafc", "#172033", "#536175", "#b8c5d4", "#cbd8e7", "#edf2f7", "Inter, system-ui, sans-serif", 12, 14, 0.13, 16, "32rem", { color: "#385477", offsetY: 14, blur: 32, spread: -12, opacity: 0.22 }],
  ["apricot-press", "#b73d35", "#dc7464", "#f3ddd2", "#e8c8ba", "#fff6ef", "#402729", "#765658", "#d6a99b", "#eab9aa", "#f8e6dc", "Lato, system-ui, sans-serif", 18, 15, 0.14, 18, undefined, { color: "#713d3b", offsetY: 16, blur: 34, spread: -13, opacity: 0.2 }],
  ["alpine-gold", "#e3b85d", "#f2d58f", "#102322", "#193331", "#1e3b38", "#f4f4e9", "#b9c9c1", "#42605a", "#20413c", "#274943", "Montserrat, system-ui, sans-serif", 10, 17, 0.2, 22, undefined, { color: "#020d0c", offsetY: 18, blur: 38, spread: -12, opacity: 0.48 }],
  ["plum-newsroom", "#9a3f68", "#c37395", "#ece7ed", "#ddd3df", "#faf7fa", "#302432", "#685b6b", "#c5b5c7", "#d4c4d8", "#f0e8f1", "Playfair Display, Georgia, serif", 8, 18, 0.12, 16, "32rem", { color: "#553d59", offsetY: 14, blur: 30, spread: -10, opacity: 0.2 }],
  ["solar-poster", "#18212f", "#39475b", "#f0d94f", "#e1c93b", "#fff8cf", "#1b1d1d", "#595748", "#aa9734", "#d8bd2e", "#f5e99a", "Montserrat, system-ui, sans-serif", 3, 10, 0.08, 8, "32rem", { color: "#352e12", offsetX: 7, offsetY: 7, blur: 0, spread: 0, opacity: 0.78 }],
  ["concrete-mint", "#167c68", "#51aa91", "#dfe4e2", "#ccd4d1", "#f4f7f6", "#202a2a", "#566564", "#aab7b3", "#c3ceca", "#e7eeeb", "Inter, system-ui, sans-serif", 14, 13, 0.12, 18, undefined, { color: "#39514d", offsetY: 15, blur: 34, spread: -13, opacity: 0.24 }]
] as const;

function relativeLuminance(color: string) {
  const normalized = color.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) return 1;
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function readableForeground(background: string, fallback: string) {
  return [fallback, "#05070a", "#ffffff"].reduce((best, candidate) =>
    contrastRatio(background, candidate) > contrastRatio(background, best) ? candidate : best
  );
}

function mixHexColors(from: string, to: string, amount: number) {
  const parse = (value: string) => {
    const normalized = value.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const fromChannels = parse(from);
  const toChannels = parse(to);
  if (!fromChannels || !toChannels) return to;
  const mixed = fromChannels.map((channel, index) =>
    Math.round(channel + (toChannels[index] - channel) * amount)
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function ensureReadableColor(preferred: string, backgrounds: string[], fallback: string) {
  const readable = (color: string) =>
    backgrounds.every((background) => contrastRatio(color, background) >= 4.5);
  if (readable(preferred)) return preferred;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexColors(preferred, fallback, step / 20);
    if (readable(candidate)) return candidate;
  }
  return [fallback, "#05070a", "#ffffff"].reduce((best, candidate) => {
    const score = Math.min(...backgrounds.map((background) => contrastRatio(candidate, background)));
    const bestScore = Math.min(...backgrounds.map((background) => contrastRatio(best, background)));
    return score > bestScore ? candidate : best;
  });
}

function pageThemeFromRow(row: ThemeRow): OrbitPageTheme {
  const [
    id, primary, primaryGlow, background, backgroundSecondary, card, foreground, muted, border,
    gradientTo, cardGradientTo, fontFamily, cardRadius, cardSpacing, glowIntensity, blurIntensity,
    maxWidth, shadow
  ] = row;
  const profileMuted = ensureReadableColor(muted, [card, cardGradientTo], foreground);
  const contentCard = {
    background: card,
    backgroundSecondary: cardGradientTo,
    foreground,
    muted: profileMuted,
    border,
    accent: primary,
    accentForeground: readableForeground(primary, foreground),
    direction: "135deg"
  };
  return {
    ...DEFAULT_ORBITPAGE_THEME,
    orbitPageAccess: { mode: "preset", presetId: id, cardPresetId: null },
    primary,
    primaryGlow,
    background,
    backgroundSecondary,
    card,
    foreground,
    muted: ensureReadableColor(muted, [background, gradientTo, card, cardGradientTo], foreground),
    accent: primary,
    border,
    backgroundGradient: { from: background, to: gradientTo, direction: "145deg" },
    cardGradient: { from: card, to: cardGradientTo, direction: "135deg" },
    profileCard: {
      background: card,
      backgroundSecondary: cardGradientTo,
      foreground,
      muted: profileMuted,
      border,
      accent: primary,
      direction: "135deg"
    },
    contentCard,
    contentCardMode: "mono",
    contentCardVariants: [contentCard],
    fontFamily,
    cardRadius,
    cardSpacing,
    maxWidth: maxWidth || "28rem",
    glowIntensity,
    blurIntensity,
    cardShadow: {
      ...DEFAULT_ORBITPAGE_THEME.cardShadow,
      color: background,
      offsetY: 12,
      blur: Math.max(16, blurIntensity + 10),
      spread: -8,
      opacity: Math.min(0.34, Math.max(0.12, glowIntensity)),
      ...shadow
    },
    backgroundMedia: {
      ...DEFAULT_ORBITPAGE_THEME.backgroundMedia,
      type: "gradient",
      overlayColor: background
    }
  };
}

type CardSurface = OrbitPageTheme["contentCard"];
type CardCatalogEntry = {
  id: string;
  mode: "mono" | "multi";
  card: CardSurface;
  variants: CardSurface[];
};

function surface(values: readonly [string, string, string, string, string, string, string, string?]): CardSurface {
  const [background, backgroundSecondary, foreground, muted, border, accent, accentForeground, direction] = values;
  const backgrounds = [background, backgroundSecondary];
  const readable = ensureReadableColor(foreground, backgrounds, readableForeground(background, foreground));
  return {
    background,
    backgroundSecondary,
    foreground: readable,
    muted: ensureReadableColor(muted, backgrounds, readable),
    border,
    accent,
    accentForeground: ensureReadableColor(accentForeground, [accent], readableForeground(accent, readable)),
    direction: direction || "145deg"
  };
}

const CARD_ROWS = [
  ["ink-signal", [["#111827", "#1f2937", "#f9fafb", "#cbd5e1", "#334155", "#3b82f6", "#ffffff"]]],
  ["porcelain", [["#fffdf7", "#f4efe3", "#171717", "#57534e", "#d6d3d1", "#171717", "#ffffff"]]],
  ["ocean-ledger", [["#0b2545", "#133c67", "#f0f9ff", "#bae6fd", "#2b5d87", "#38bdf8", "#082f49"]]],
  ["moss-paper", [["#e7eadf", "#d7ddc8", "#26351f", "#526149", "#aab89b", "#395b2c", "#ffffff"]]],
  ["mono-redline", [["#f5f5f4", "#e7e5e4", "#1c1917", "#57534e", "#a8a29e", "#dc2626", "#ffffff"]]],
  ["highlighter", [["#fde047", "#facc15", "#1c1917", "#44403c", "#ca8a04", "#1c1917", "#ffffff"]]],
  ["sunset-stack", [
    ["#be123c", "#9f1239", "#fff7ed", "#ffe4e6", "#881337", "#fff7ed", "#881337"],
    ["#f59e0b", "#ea580c", "#1c1917", "#422006", "#c2410c", "#1c1917", "#ffffff"],
    ["#fff7ed", "#fed7aa", "#7c2d12", "#9a3412", "#fb923c", "#c2410c", "#ffffff"],
    ["#881337", "#4c0519", "#fff1f2", "#fecdd3", "#be123c", "#fb7185", "#4c0519"]
  ]],
  ["coastal-sequence", [
    ["#0f172a", "#164e63", "#f0fdfa", "#a5f3fc", "#155e75", "#22d3ee", "#083344"],
    ["#0f766e", "#115e59", "#f0fdfa", "#ccfbf1", "#2dd4bf", "#f0fdfa", "#115e59"],
    ["#7dd3fc", "#38bdf8", "#082f49", "#0c4a6e", "#0284c7", "#082f49", "#ffffff"],
    ["#f0fdfa", "#cffafe", "#134e4a", "#0f766e", "#5eead4", "#0f766e", "#ffffff"]
  ]],
  ["studio-pop", [
    ["#2563eb", "#1d4ed8", "#eff6ff", "#dbeafe", "#60a5fa", "#facc15", "#172554"],
    ["#dc2626", "#991b1b", "#fff7ed", "#fee2e2", "#f87171", "#facc15", "#450a0a"],
    ["#facc15", "#eab308", "#1c1917", "#44403c", "#ca8a04", "#2563eb", "#ffffff"],
    ["#fff7ed", "#ffedd5", "#1e3a8a", "#475569", "#fdba74", "#dc2626", "#ffffff"]
  ]],
  ["garden-notes", [
    ["#14532d", "#166534", "#f0fdf4", "#bbf7d0", "#22c55e", "#fbbf24", "#422006"],
    ["#9ab9a0", "#7fa096", "#081c15", "#1b4332", "#52796f", "#081c15", "#ffffff"],
    ["#ecfccb", "#d9f99d", "#365314", "#4d7c0f", "#bef264", "#3f6212", "#ffffff"],
    ["#c2410c", "#9a3412", "#fff7ed", "#fed7aa", "#fb923c", "#ffedd5", "#7c2d12"]
  ]],
  ["night-market", [
    ["#18181b", "#27272a", "#fafafa", "#d4d4d8", "#52525b", "#22d3ee", "#083344"],
    ["#4c0519", "#881337", "#fff1f2", "#fecdd3", "#be123c", "#fb7185", "#4c0519"],
    ["#3b0764", "#6b21a8", "#faf5ff", "#e9d5ff", "#9333ea", "#d8b4fe", "#3b0764"],
    ["#78350f", "#b45309", "#fffbeb", "#fde68a", "#d97706", "#facc15", "#422006"]
  ]],
  ["pastel-relay", [
    ["#ede9fe", "#ddd6fe", "#4c1d95", "#6d28d9", "#c4b5fd", "#7c3aed", "#ffffff"],
    ["#ffedd5", "#fed7aa", "#7c2d12", "#9a3412", "#fdba74", "#ea580c", "#ffffff"],
    ["#d1fae5", "#a7f3d0", "#064e3b", "#047857", "#6ee7b7", "#059669", "#ffffff"],
    ["#e0f2fe", "#bae6fd", "#0c4a6e", "#0369a1", "#7dd3fc", "#0284c7", "#ffffff"]
  ]]
] as const;

export const ORBITPAGE_THEME_PRESETS = Object.fromEntries(
  PAGE_THEME_ROWS.map((row) => [row[0], pageThemeFromRow(row)])
) as Record<string, OrbitPageTheme>;

export const ORBITPAGE_CARD_PRESETS = Object.fromEntries(
  CARD_ROWS.map(([id, variants]) => {
    const parsed = variants.map((variant) => surface(variant));
    const entry: CardCatalogEntry = {
      id,
      mode: parsed.length === 1 ? "mono" : "multi",
      card: parsed[0],
      variants: parsed
    };
    return [id, entry];
  })
) as Record<string, CardCatalogEntry>;

export const ORBITPAGE_ESSENTIAL_THEME_IDS = new Set([
  "default",
  "midnight-signal",
  "paper-ink",
  "terracotta-studio"
]);

export const ORBITPAGE_PREMIUM_THEME_IDS = new Set([
  "default",
  ...Object.keys(ORBITPAGE_THEME_PRESETS)
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)])
  );
}

function equalJson(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function themeWithout(
  theme: OrbitPageTheme,
  keys: Array<keyof OrbitPageTheme>
) {
  const copy = { ...theme } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy;
}

function contentCardMatchesKnownPreset(theme: OrbitPageTheme) {
  const candidates = [
    DEFAULT_ORBITPAGE_THEME,
    ...Object.values(ORBITPAGE_THEME_PRESETS)
  ].map((candidate) => ({
    contentCard: candidate.contentCard,
    contentCardMode: candidate.contentCardMode,
    contentCardVariants: candidate.contentCardVariants
  }));
  candidates.push(...Object.values(ORBITPAGE_CARD_PRESETS).map((candidate) => ({
    contentCard: candidate.card,
    contentCardMode: candidate.mode,
    contentCardVariants: candidate.variants
  })));
  return candidates.some((candidate) =>
    equalJson(theme.contentCard, candidate.contentCard) &&
    theme.contentCardMode === candidate.contentCardMode &&
    equalJson(theme.contentCardVariants, candidate.contentCardVariants)
  );
}

export function isOrbitPageThemePresetConfiguration(
  theme: OrbitPageTheme,
  access: "essential" | "premium"
) {
  const metadata = theme.orbitPageAccess;
  if (metadata.mode !== "preset" || !metadata.presetId) return false;
  const allowedIds = access === "essential"
    ? ORBITPAGE_ESSENTIAL_THEME_IDS
    : ORBITPAGE_PREMIUM_THEME_IDS;
  if (!allowedIds.has(metadata.presetId)) return false;

  const pagePreset = metadata.presetId === "default"
    ? DEFAULT_ORBITPAGE_THEME
    : ORBITPAGE_THEME_PRESETS[metadata.presetId];
  if (!pagePreset) return false;
  if (theme.cardBlurTint) return false;
  if (
    theme.profileCardEffect !== pagePreset.profileCardEffect ||
    theme.contentCardEffect !== pagePreset.contentCardEffect ||
    theme.profileCardOpacity !== pagePreset.profileCardOpacity ||
    theme.contentCardOpacity !== pagePreset.contentCardOpacity
  ) {
    return false;
  }

  const ignored: Array<keyof OrbitPageTheme> = [
    "orbitPageAccess",
    "content",
    "contentCard",
    "contentCardMode",
    "contentCardVariants"
  ];
  const cardPreset = metadata.cardPresetId
    ? ORBITPAGE_CARD_PRESETS[metadata.cardPresetId]
    : undefined;
  if (metadata.cardPresetId && (!cardPreset || access === "essential")) return false;
  if (cardPreset) ignored.push("card", "cardGradient");
  if (!equalJson(themeWithout(theme, ignored), themeWithout(pagePreset, ignored))) return false;

  if (cardPreset) {
    return (
      theme.card === cardPreset.card.background &&
      equalJson(theme.cardGradient, {
        from: cardPreset.card.background,
        to: cardPreset.card.backgroundSecondary,
        direction: cardPreset.card.direction
      }) &&
      theme.contentCardMode === cardPreset.mode &&
      equalJson(theme.contentCard, cardPreset.card) &&
      equalJson(theme.contentCardVariants, cardPreset.variants)
    );
  }
  return contentCardMatchesKnownPreset(theme);
}
