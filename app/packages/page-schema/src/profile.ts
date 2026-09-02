import { z } from "zod";
import {
  OrbitPageHrefCandidateSchema,
  OrbitPageHexColorSchema,
  OrbitPagePublicHrefInputSchema,
  OrbitPagePublicHrefSchema,
  boundedString,
  stripSocialUsernameDecorators,
  normalizeOrbitPagePublicHref,
  parseOrThrow
} from "./primitives";

export const ORBITPAGE_SOCIAL_PLATFORMS = [
  "linkedin",
  "github",
  "instagram",
  "facebook",
  "twitter",
  "youtube",
  "tiktok",
  "discord",
  "telegram",
  "whatsapp",
  "mastodon"
] as const;

export const ORBITPAGE_PROFILE_LAYOUT_ITEMS = [
  "avatar",
  "name",
  "work",
  "location",
  "socials",
  "bio"
] as const;

export type OrbitPageProfileLayoutItem = typeof ORBITPAGE_PROFILE_LAYOUT_ITEMS[number];

const OrbitPageProfileLayoutItemSchema = z.enum(ORBITPAGE_PROFILE_LAYOUT_ITEMS);
const OrbitPageProfileLayoutSpansSchema = z.object(
  Object.fromEntries(
    ORBITPAGE_PROFILE_LAYOUT_ITEMS.map((item) => [item, z.union([z.literal(1), z.literal(2)]).optional()])
  ) as Record<OrbitPageProfileLayoutItem, z.ZodOptional<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>>>
).strict();

export const OrbitPageProfileLayoutSchema = z.object({
  order: z.array(OrbitPageProfileLayoutItemSchema)
    .max(ORBITPAGE_PROFILE_LAYOUT_ITEMS.length)
    .refine((items) => new Set(items).size === items.length, "Profile layout items must be unique.")
    .optional(),
  spans: OrbitPageProfileLayoutSpansSchema.optional(),
  gap: z.number().int().min(8).max(32).optional()
}).strict();

export type OrbitPageProfileLayout = z.infer<typeof OrbitPageProfileLayoutSchema>;

const OptionalHex = OrbitPageHexColorSchema.nullable().optional();
const OptionalNumber = z.number().finite().nullable().optional();

export const OrbitPageProfileAppearanceSchema = z.object({
  surfaceEffect: z.enum(["inherit", "solid", "transparent", "liquid-glass"]).nullable().optional(),
  surfaceOpacity: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 0 && value <= 1)),
  surfaceBlur: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 0 && value <= 40)),
  cardBackgroundColor: OptionalHex,
  cardTextColor: OptionalHex,
  cardMutedColor: OptionalHex,
  cardBorderEnabled: z.boolean().nullable().optional(),
  cardBorderColor: OptionalHex,
  cardBorderWidth: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 0 && value <= 6)),
  cardRadius: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 0 && value <= 40)),
  cardShadowColor: OptionalHex,
  cardShadowOpacity: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 0 && value <= 0.6)),
  accentColor: OptionalHex,
  avatarBorderEnabled: z.boolean().nullable().optional(),
  avatarBorderColor: OptionalHex,
  avatarShape: z.enum(["round", "rounded", "square"]).nullable().optional(),
  avatarSize: OptionalNumber.refine((value) => value === null || value === undefined || (value >= 56 && value <= 192)),
  profilePreset: z.enum(["creator", "company", "studio"]).nullable().optional(),
  profileDetails: z.object({
    primary: boundedString(200).nullable().optional(),
    secondary: boundedString(200).nullable().optional()
  }).strict().nullable().optional(),
  layout: OrbitPageProfileLayoutSchema.nullable().optional()
}).strict();

function migrateProfileAppearanceInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const appearance = value as Record<string, unknown>;
  return appearance.avatarShape === "circle"
    ? { ...appearance, avatarShape: "round" }
    : value;
}

const OrbitPageProfileAppearanceInputSchema = z.preprocess(
  migrateProfileAppearanceInput,
  OrbitPageProfileAppearanceSchema
);

function normalizeStoredProfileAppearance(value: unknown) {
  if (value === undefined || value === null) return value;
  const migrated = migrateProfileAppearanceInput(value);
  if (!migrated || typeof migrated !== "object" || Array.isArray(migrated)) return {};

  const normalized: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(migrated)) {
    const result = OrbitPageProfileAppearanceSchema.safeParse({ [key]: candidate });
    if (result.success) Object.assign(normalized, result.data);
  }
  return normalized;
}

export const OrbitPageSocialLinksSchema = z.object(
  Object.fromEntries(
    ORBITPAGE_SOCIAL_PLATFORMS.map((platform) => [
      platform,
      OrbitPagePublicHrefSchema.nullable().optional()
    ])
  ) as Record<typeof ORBITPAGE_SOCIAL_PLATFORMS[number], z.ZodOptional<z.ZodNullable<typeof OrbitPagePublicHrefSchema>>>
).strict();

const OrbitPageSocialLinksInputSchema = z.object(
  Object.fromEntries(
    ORBITPAGE_SOCIAL_PLATFORMS.map((platform) => [
      platform,
      OrbitPageHrefCandidateSchema.nullable().optional()
    ])
  ) as Record<
    typeof ORBITPAGE_SOCIAL_PLATFORMS[number],
    z.ZodOptional<z.ZodNullable<typeof OrbitPageHrefCandidateSchema>>
  >
).strict();

const PROFILE_SOCIAL_USERNAME_BASES: Partial<Record<typeof ORBITPAGE_SOCIAL_PLATFORMS[number], string>> = {
  linkedin: "https://www.linkedin.com/in/",
  github: "https://github.com/",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  twitter: "https://x.com/",
  youtube: "https://www.youtube.com/@",
  tiktok: "https://www.tiktok.com/@",
  discord: "https://discord.gg/",
  telegram: "https://t.me/"
};

function normalizeProfileSocialHref(
  platform: typeof ORBITPAGE_SOCIAL_PLATFORMS[number],
  value: string
) {
  const candidate = value.trim();
  const existingHref = normalizeOrbitPagePublicHref(candidate);
  if (existingHref !== null) return existingHref;

  const base = PROFILE_SOCIAL_USERNAME_BASES[platform];
  if (base) {
    const username = stripSocialUsernameDecorators(candidate);
    if (/^[a-z0-9._-]{1,100}$/i.test(username)) return `${base}${username}`;
  }

  if (platform === "whatsapp" && /^[+\d\s().-]+$/.test(candidate)) {
    const phone = candidate.replace(/\D/g, "");
    return phone.length >= 6 && phone.length <= 15 ? `https://wa.me/${phone}` : null;
  }

  return null;
}

function canonicalSocialLinks(value: unknown) {
  const input = parseOrThrow(
    OrbitPageSocialLinksInputSchema,
    value,
    "The profile social links contain invalid or unsupported data."
  );
  return parseOrThrow(OrbitPageSocialLinksSchema, Object.fromEntries(
    Object.entries(input).map(([platform, candidate]) => [
      platform,
      candidate === null || candidate === undefined
        ? candidate
        : normalizeProfileSocialHref(platform as typeof ORBITPAGE_SOCIAL_PLATFORMS[number], candidate) ?? candidate
    ])
  ), "The profile social links contain invalid or unsupported data.");
}

const NumericBooleanSchema = z.union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => value === true || value === 1 ? 1 as const : 0 as const);

export const OrbitPageProfileSchema = z.object({
  name: boundedString(120),
  bio: boundedString(2_000),
  avatar: boundedString(2_048),
  social_links: OrbitPageSocialLinksSchema,
  show_avatar: z.union([z.literal(0), z.literal(1)]),
  name_font_size: boundedString(40).nullable().optional(),
  bio_font_size: boundedString(40).nullable().optional(),
  tab_title: boundedString(80).nullable().optional(),
  meta_description: boundedString(180).nullable().optional(),
  footer_text: boundedString(500).nullable().optional(),
  show_orbitpage_badge: z.boolean().optional(),
  favicon: boundedString(2_048).nullable().optional(),
  google_analytics_id: boundedString(40).regex(/^G-[A-Z0-9]{4,32}$/i).nullable().optional(),
  privacy_policy_url: OrbitPagePublicHrefSchema.nullable().optional(),
  cookie_policy_url: OrbitPagePublicHrefSchema.nullable().optional(),
  admin_onboarding_enabled: z.union([z.literal(0), z.literal(1)]),
  appearance: OrbitPageProfileAppearanceSchema.nullable().optional()
}).strict();

export type OrbitPageProfile = z.infer<typeof OrbitPageProfileSchema>;

export const DEFAULT_ORBITPAGE_PROFILE: OrbitPageProfile = {
  name: "",
  bio: "",
  avatar: "",
  social_links: {},
  show_avatar: 1,
  admin_onboarding_enabled: 0
};

const ProfileInputShape = {
  name: boundedString(120).optional(),
  bio: boundedString(2_000).optional(),
  avatar: boundedString(2_048).optional(),
  social_links: OrbitPageSocialLinksInputSchema.optional(),
  socialLinks: OrbitPageSocialLinksInputSchema.optional(),
  show_avatar: NumericBooleanSchema.optional(),
  showAvatar: NumericBooleanSchema.optional(),
  name_font_size: boundedString(40).nullable().optional(),
  nameFontSize: boundedString(40).nullable().optional(),
  bio_font_size: boundedString(40).nullable().optional(),
  bioFontSize: boundedString(40).nullable().optional(),
  tab_title: boundedString(80).nullable().optional(),
  tabTitle: boundedString(80).nullable().optional(),
  meta_description: boundedString(180).nullable().optional(),
  metaDescription: boundedString(180).nullable().optional(),
  footer_text: boundedString(500).nullable().optional(),
  footerText: boundedString(500).nullable().optional(),
  show_orbitpage_badge: z.boolean().optional(),
  showOrbitPageBadge: z.boolean().optional(),
  favicon: boundedString(2_048).nullable().optional(),
  google_analytics_id: boundedString(40).regex(/^G-[A-Z0-9]{4,32}$/i).nullable().optional(),
  googleAnalyticsId: boundedString(40).regex(/^G-[A-Z0-9]{4,32}$/i).nullable().optional(),
  privacy_policy_url: OrbitPagePublicHrefInputSchema.nullable().optional(),
  privacyPolicyUrl: OrbitPagePublicHrefInputSchema.nullable().optional(),
  cookie_policy_url: OrbitPagePublicHrefInputSchema.nullable().optional(),
  cookiePolicyUrl: OrbitPagePublicHrefInputSchema.nullable().optional(),
  admin_onboarding_enabled: NumericBooleanSchema.optional(),
  adminOnboardingEnabled: NumericBooleanSchema.optional(),
  appearance: OrbitPageProfileAppearanceInputSchema.nullable().optional()
};

export const OrbitPageProfilePatchSchema = z.object(ProfileInputShape).strict();
const LegacyProfileInputSchema = z.object({
  ...ProfileInputShape,
  appearance: z.unknown().optional()
});

function firstDefined(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function canonicalProfilePatch(value: unknown, strict: boolean): Partial<OrbitPageProfile> {
  const schema = strict ? OrbitPageProfilePatchSchema : LegacyProfileInputSchema;
  const input = parseOrThrow(schema, value, "The profile contains invalid or unsupported data.") as Record<string, unknown>;
  const patch: Partial<OrbitPageProfile> = {};
  const assign = <K extends keyof OrbitPageProfile>(key: K, candidate: OrbitPageProfile[K] | undefined) => {
    if (candidate !== undefined) patch[key] = candidate;
  };
  const socialLinks = firstDefined(input, "social_links", "socialLinks");
  const privacyPolicyUrl = firstDefined(input, "privacy_policy_url", "privacyPolicyUrl");
  const cookiePolicyUrl = firstDefined(input, "cookie_policy_url", "cookiePolicyUrl");
  assign("name", input.name as OrbitPageProfile["name"] | undefined);
  assign("bio", input.bio as OrbitPageProfile["bio"] | undefined);
  assign("avatar", input.avatar as OrbitPageProfile["avatar"] | undefined);
  assign("social_links", socialLinks === undefined
    ? undefined
    : canonicalSocialLinks(socialLinks));
  assign("show_avatar", firstDefined(input, "show_avatar", "showAvatar") as OrbitPageProfile["show_avatar"] | undefined);
  assign("name_font_size", firstDefined(input, "name_font_size", "nameFontSize") as OrbitPageProfile["name_font_size"] | undefined);
  assign("bio_font_size", firstDefined(input, "bio_font_size", "bioFontSize") as OrbitPageProfile["bio_font_size"] | undefined);
  assign("tab_title", firstDefined(input, "tab_title", "tabTitle") as OrbitPageProfile["tab_title"] | undefined);
  assign("meta_description", firstDefined(input, "meta_description", "metaDescription") as OrbitPageProfile["meta_description"] | undefined);
  assign("footer_text", firstDefined(input, "footer_text", "footerText") as OrbitPageProfile["footer_text"] | undefined);
  assign("show_orbitpage_badge", firstDefined(input, "show_orbitpage_badge", "showOrbitPageBadge") as OrbitPageProfile["show_orbitpage_badge"] | undefined);
  assign("favicon", input.favicon as OrbitPageProfile["favicon"] | undefined);
  assign("google_analytics_id", firstDefined(input, "google_analytics_id", "googleAnalyticsId") as OrbitPageProfile["google_analytics_id"] | undefined);
  assign("privacy_policy_url", privacyPolicyUrl === undefined || privacyPolicyUrl === null
    ? privacyPolicyUrl as undefined | null
    : normalizeOrbitPagePublicHref(String(privacyPolicyUrl)) ?? String(privacyPolicyUrl));
  assign("cookie_policy_url", cookiePolicyUrl === undefined || cookiePolicyUrl === null
    ? cookiePolicyUrl as undefined | null
    : normalizeOrbitPagePublicHref(String(cookiePolicyUrl)) ?? String(cookiePolicyUrl));
  assign("admin_onboarding_enabled", firstDefined(input, "admin_onboarding_enabled", "adminOnboardingEnabled") as OrbitPageProfile["admin_onboarding_enabled"] | undefined);
  assign("appearance", (
    strict ? input.appearance : normalizeStoredProfileAppearance(input.appearance)
  ) as OrbitPageProfile["appearance"] | undefined);
  return patch;
}

export function parseOrbitPageProfilePatch(value: unknown) {
  return canonicalProfilePatch(value, true);
}

export function parseOrbitPageProfile(value: unknown) {
  return parseOrThrow(
    OrbitPageProfileSchema,
    value,
    "The profile contains invalid or unsupported data."
  );
}

export function normalizeStoredOrbitPageProfile(value: unknown, defaults: Partial<OrbitPageProfile> = {}) {
  const patch = canonicalProfilePatch(value, false);
  return parseOrThrow(OrbitPageProfileSchema, {
    ...DEFAULT_ORBITPAGE_PROFILE,
    ...defaults,
    ...patch,
    social_links: patch.social_links ?? defaults.social_links ?? DEFAULT_ORBITPAGE_PROFILE.social_links
  }, "The profile contains invalid or unsupported data.");
}

export function applyOrbitPageProfilePatch(current: unknown, patch: unknown) {
  const normalized = normalizeStoredOrbitPageProfile(current);
  return parseOrThrow(OrbitPageProfileSchema, {
    ...normalized,
    ...parseOrbitPageProfilePatch(patch)
  }, "The profile contains invalid or unsupported data.");
}
