import { z } from "zod";
import {
  OrbitPageHexColorSchema,
  boundedString,
  isPlainObject,
  parseOrThrow
} from "./primitives";

const GradientDirectionSchema = z.string().trim().regex(/^(?:[0-9]{1,3}(?:\.[0-9]+)?deg|to (?:top|bottom|left|right)(?: (?:top|bottom|left|right))?)$/);
const CssWidthSchema = z.string().trim().regex(/^(?:[1-9]\d?(?:\.\d+)?)(?:rem|px|vw)$/);
const FontFamilySchema = boundedString(200).refine((value) => !/[;{}<>]/.test(value), "Unsupported font-family value.");

const GradientSchema = z.object({
  from: OrbitPageHexColorSchema,
  to: OrbitPageHexColorSchema,
  direction: GradientDirectionSchema
}).strict();

const GradientInputSchema = GradientSchema.partial().strict();

const CardSurfaceSchema = z.object({
  background: OrbitPageHexColorSchema,
  backgroundSecondary: OrbitPageHexColorSchema,
  foreground: OrbitPageHexColorSchema,
  muted: OrbitPageHexColorSchema,
  border: OrbitPageHexColorSchema,
  accent: OrbitPageHexColorSchema,
  direction: GradientDirectionSchema
}).strict();

const ContentCardSurfaceSchema = CardSurfaceSchema.extend({
  accentForeground: OrbitPageHexColorSchema
}).strict();

const CardSurfaceInputSchema = CardSurfaceSchema.partial().strict();
const ContentCardSurfaceInputSchema = ContentCardSurfaceSchema.partial().strict();

const CardShadowSchema = z.object({
  color: OrbitPageHexColorSchema,
  offsetX: z.number().finite().min(-32).max(32),
  offsetY: z.number().finite().min(-32).max(48),
  blur: z.number().finite().min(0).max(96),
  spread: z.number().finite().min(-32).max(48),
  opacity: z.number().finite().min(0).max(1)
}).strict();

const CardShadowInputSchema = CardShadowSchema.partial().strict();

const BackgroundMediaSchema = z.object({
  type: z.enum(["color", "gradient", "video", "gif"]),
  mediaUrl: boundedString(2_048).nullable().optional(),
  opacity: z.number().finite().min(0).max(1),
  blur: z.number().finite().min(0).max(40),
  overlayColor: OrbitPageHexColorSchema,
  overlayOpacity: z.number().finite().min(0).max(1),
  brightness: z.number().finite().min(0).max(3),
  saturation: z.number().finite().min(0).max(3),
  contrast: z.number().finite().min(0).max(3),
  scale: z.number().finite().min(0.5).max(3),
  objectFit: z.enum(["cover", "contain", "fill"]),
  glassmorphism: z.boolean()
}).strict();

const BackgroundMediaInputSchema = BackgroundMediaSchema.partial().strict();

const ThemeContentSchema = z.object({
  profileName: boundedString(200),
  profileBio: boundedString(2_000),
  footerText: boundedString(500),
  adminTitle: boundedString(200)
}).strict();

const ThemeContentInputSchema = ThemeContentSchema.partial().strict();

const ThemeAccessSchema = z.object({
  mode: z.enum(["preset", "custom"]),
  presetId: boundedString(80).nullable().optional(),
  cardPresetId: boundedString(80).nullable().optional()
}).strict();

export const OrbitPageThemeSchema = z.object({
  orbitPageAccess: ThemeAccessSchema,
  primary: OrbitPageHexColorSchema,
  primaryGlow: OrbitPageHexColorSchema,
  background: OrbitPageHexColorSchema,
  backgroundSecondary: OrbitPageHexColorSchema,
  card: OrbitPageHexColorSchema,
  foreground: OrbitPageHexColorSchema,
  muted: OrbitPageHexColorSchema,
  accent: OrbitPageHexColorSchema,
  border: OrbitPageHexColorSchema,
  backgroundGradient: GradientSchema,
  cardGradient: GradientSchema,
  profileCard: CardSurfaceSchema,
  contentCard: ContentCardSurfaceSchema,
  contentCardMode: z.enum(["mono", "multi"]),
  contentCardVariants: z.array(ContentCardSurfaceSchema).min(1).max(8),
  profileCardOpacity: z.number().finite().min(0).max(1),
  contentCardOpacity: z.number().finite().min(0).max(1),
  profileCardEffect: z.enum(["solid", "transparent", "liquid-glass"]),
  contentCardEffect: z.enum(["solid", "transparent", "liquid-glass"]),
  fontFamily: FontFamilySchema,
  cardRadius: z.number().finite().min(0).max(48),
  cardSpacing: z.number().finite().min(0).max(64),
  maxWidth: CssWidthSchema,
  glowIntensity: z.number().finite().min(0).max(1),
  blurIntensity: z.number().finite().min(0).max(96),
  cardShadow: CardShadowSchema,
  backgroundMedia: BackgroundMediaSchema,
  content: ThemeContentSchema,
  cardBlurTint: OrbitPageHexColorSchema.nullable().optional()
}).strict();

export type OrbitPageTheme = z.infer<typeof OrbitPageThemeSchema>;

export const DEFAULT_ORBITPAGE_THEME: OrbitPageTheme = {
  orbitPageAccess: {
    mode: "preset",
    presetId: "default",
    cardPresetId: null
  },
  primary: "#2f81f7",
  primaryGlow: "#58a6ff",
  background: "#0d1117",
  backgroundSecondary: "#161b22",
  card: "#1c2433",
  foreground: "#e6edf3",
  muted: "#8b949e",
  accent: "#1f6feb",
  border: "#21262d",
  backgroundGradient: {
    from: "#0d1117",
    to: "#111827",
    direction: "135deg"
  },
  cardGradient: {
    from: "#1c2433",
    to: "#21303f",
    direction: "135deg"
  },
  profileCard: {
    background: "#1c2433",
    backgroundSecondary: "#21303f",
    foreground: "#e6edf3",
    muted: "#8b949e",
    border: "#21262d",
    accent: "#2f81f7",
    direction: "135deg"
  },
  contentCard: {
    background: "#1c2433",
    backgroundSecondary: "#21303f",
    foreground: "#e6edf3",
    muted: "#8b949e",
    border: "#21262d",
    accent: "#2f81f7",
    accentForeground: "#f8fafc",
    direction: "135deg"
  },
  contentCardMode: "mono",
  contentCardVariants: [{
    background: "#1c2433",
    backgroundSecondary: "#21303f",
    foreground: "#e6edf3",
    muted: "#8b949e",
    border: "#21262d",
    accent: "#2f81f7",
    accentForeground: "#f8fafc",
    direction: "135deg"
  }],
  profileCardOpacity: 1,
  contentCardOpacity: 1,
  profileCardEffect: "solid",
  contentCardEffect: "solid",
  fontFamily: "Inter, system-ui, sans-serif",
  cardRadius: 12,
  cardSpacing: 12,
  maxWidth: "28rem",
  glowIntensity: 0.45,
  blurIntensity: 28,
  cardShadow: {
    color: "#07111f",
    offsetX: 0,
    offsetY: 14,
    blur: 36,
    spread: -12,
    opacity: 0.28
  },
  backgroundMedia: {
    type: "gradient",
    opacity: 1,
    blur: 0,
    overlayColor: "#000000",
    overlayOpacity: 0,
    brightness: 1,
    saturation: 1,
    contrast: 1,
    scale: 1,
    objectFit: "cover",
    glassmorphism: false
  },
  content: {
    profileName: "",
    profileBio: "",
    footerText: "",
    adminTitle: "Link Manager Admin"
  }
};

const ThemeInputShape = {
  orbitPageAccess: ThemeAccessSchema.optional(),
  primary: OrbitPageHexColorSchema.optional(),
  primaryColor: OrbitPageHexColorSchema.optional(),
  primaryGlow: OrbitPageHexColorSchema.optional(),
  background: OrbitPageHexColorSchema.optional(),
  backgroundColor: OrbitPageHexColorSchema.optional(),
  backgroundSecondary: OrbitPageHexColorSchema.optional(),
  card: OrbitPageHexColorSchema.optional(),
  foreground: OrbitPageHexColorSchema.optional(),
  textColor: OrbitPageHexColorSchema.optional(),
  muted: OrbitPageHexColorSchema.optional(),
  accent: OrbitPageHexColorSchema.optional(),
  border: OrbitPageHexColorSchema.optional(),
  backgroundGradient: GradientInputSchema.optional(),
  cardGradient: GradientInputSchema.optional(),
  profileCard: CardSurfaceInputSchema.optional(),
  contentCard: ContentCardSurfaceInputSchema.optional(),
  contentCardMode: z.enum(["mono", "multi"]).optional(),
  contentCardVariants: z.array(ContentCardSurfaceInputSchema).max(8).optional(),
  profileCardOpacity: z.number().finite().min(0).max(1).optional(),
  contentCardOpacity: z.number().finite().min(0).max(1).optional(),
  profileCardEffect: z.enum(["solid", "transparent", "liquid-glass"]).optional(),
  contentCardEffect: z.enum(["solid", "transparent", "liquid-glass"]).optional(),
  fontFamily: FontFamilySchema.optional(),
  cardRadius: z.number().finite().min(0).max(48).optional(),
  cardSpacing: z.number().finite().min(0).max(64).optional(),
  maxWidth: CssWidthSchema.optional(),
  glowIntensity: z.number().finite().min(0).max(1).optional(),
  blurIntensity: z.number().finite().min(0).max(96).optional(),
  cardShadow: CardShadowInputSchema.optional(),
  backgroundMedia: BackgroundMediaInputSchema.optional(),
  content: ThemeContentInputSchema.optional(),
  cardBlurTint: OrbitPageHexColorSchema.nullable().optional()
};

const StrictThemeInputSchema = z.object(ThemeInputShape).strict();
const LegacyThemeInputSchema = z.object(ThemeInputShape);

function mergeObject<T extends Record<string, unknown>>(base: T, value: unknown): T {
  return isPlainObject(value) ? { ...base, ...value } : { ...base };
}

function readableForeground(background: string, fallback: string) {
  const normalized = background.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.58
    ? "#172033"
    : "#f8fafc";
}

export function normalizeOrbitPageTheme(value: unknown, strict = false): OrbitPageTheme {
  const input = parseOrThrow(
    strict ? StrictThemeInputSchema : LegacyThemeInputSchema,
    value ?? {},
    "The theme contains invalid or unsupported data."
  );
  const primary = input.primary ?? input.primaryColor ?? DEFAULT_ORBITPAGE_THEME.primary;
  const background = input.background ?? input.backgroundColor ?? DEFAULT_ORBITPAGE_THEME.background;
  const foreground = input.foreground ?? input.textColor ?? DEFAULT_ORBITPAGE_THEME.foreground;
  const {
    primaryColor: _primaryColor,
    backgroundColor: _backgroundColor,
    textColor: _textColor,
    ...canonicalInput
  } = input;
  const card = input.card ?? background;
  const cardGradient = input.cardGradient
    ? mergeObject(DEFAULT_ORBITPAGE_THEME.cardGradient, input.cardGradient)
    : {
        from: card,
        to: input.backgroundSecondary ?? card,
        direction: DEFAULT_ORBITPAGE_THEME.cardGradient.direction
      };
  const contentCard = mergeObject({
    ...DEFAULT_ORBITPAGE_THEME.contentCard,
    background: card,
    backgroundSecondary: cardGradient.to,
    foreground,
    muted: input.muted ?? DEFAULT_ORBITPAGE_THEME.muted,
    border: input.border ?? DEFAULT_ORBITPAGE_THEME.border,
    accent: primary,
    accentForeground: readableForeground(primary, foreground),
    direction: cardGradient.direction
  }, input.contentCard);
  const requestedVariants = Array.isArray(input.contentCardVariants)
    ? input.contentCardVariants.map((variant) => mergeObject(contentCard, variant))
    : [];

  return parseOrThrow(OrbitPageThemeSchema, {
    ...DEFAULT_ORBITPAGE_THEME,
    ...canonicalInput,
    primary,
    background,
    foreground,
    card,
    backgroundGradient: input.backgroundGradient
      ? mergeObject(DEFAULT_ORBITPAGE_THEME.backgroundGradient, input.backgroundGradient)
      : {
          ...DEFAULT_ORBITPAGE_THEME.backgroundGradient,
          from: background,
          to: background
        },
    cardGradient,
    profileCard: mergeObject({
      ...DEFAULT_ORBITPAGE_THEME.profileCard,
      background: card,
      backgroundSecondary: cardGradient.to,
      foreground,
      accent: primary,
      direction: cardGradient.direction
    }, input.profileCard),
    contentCard,
    contentCardVariants: requestedVariants.length ? requestedVariants : [contentCard],
    cardShadow: mergeObject(DEFAULT_ORBITPAGE_THEME.cardShadow, input.cardShadow),
    backgroundMedia: mergeObject(DEFAULT_ORBITPAGE_THEME.backgroundMedia, input.backgroundMedia),
    content: mergeObject(DEFAULT_ORBITPAGE_THEME.content, input.content),
    orbitPageAccess: input.orbitPageAccess ?? DEFAULT_ORBITPAGE_THEME.orbitPageAccess
  }, "The theme contains invalid or unsupported data.");
}

export function parseOrbitPageTheme(value: unknown) {
  return normalizeOrbitPageTheme(value, true);
}
