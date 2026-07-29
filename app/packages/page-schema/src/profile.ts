import { z } from "zod";
import {
  OrbitPageHexColorSchema,
  OrbitPagePublicHrefSchema,
  boundedString,
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
  }).strict().nullable().optional()
}).strict();

export const OrbitPageSocialLinksSchema = z.object(
  Object.fromEntries(
    ORBITPAGE_SOCIAL_PLATFORMS.map((platform) => [
      platform,
      OrbitPagePublicHrefSchema.nullable().optional()
    ])
  ) as Record<typeof ORBITPAGE_SOCIAL_PLATFORMS[number], z.ZodOptional<z.ZodNullable<typeof OrbitPagePublicHrefSchema>>>
).strict();

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
  social_links: OrbitPageSocialLinksSchema.optional(),
  socialLinks: OrbitPageSocialLinksSchema.optional(),
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
  favicon: boundedString(2_048).nullable().optional(),
  google_analytics_id: boundedString(40).regex(/^G-[A-Z0-9]{4,32}$/i).nullable().optional(),
  googleAnalyticsId: boundedString(40).regex(/^G-[A-Z0-9]{4,32}$/i).nullable().optional(),
  privacy_policy_url: OrbitPagePublicHrefSchema.nullable().optional(),
  privacyPolicyUrl: OrbitPagePublicHrefSchema.nullable().optional(),
  cookie_policy_url: OrbitPagePublicHrefSchema.nullable().optional(),
  cookiePolicyUrl: OrbitPagePublicHrefSchema.nullable().optional(),
  admin_onboarding_enabled: NumericBooleanSchema.optional(),
  adminOnboardingEnabled: NumericBooleanSchema.optional(),
  appearance: OrbitPageProfileAppearanceSchema.nullable().optional()
};

const StrictProfileInputSchema = z.object(ProfileInputShape).strict();
const LegacyProfileInputSchema = z.object(ProfileInputShape);

function firstDefined(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function canonicalProfilePatch(value: unknown, strict: boolean): Partial<OrbitPageProfile> {
  const schema = strict ? StrictProfileInputSchema : LegacyProfileInputSchema;
  const input = parseOrThrow(schema, value, "The profile contains invalid or unsupported data.") as Record<string, unknown>;
  const patch: Partial<OrbitPageProfile> = {};
  const assign = <K extends keyof OrbitPageProfile>(key: K, candidate: OrbitPageProfile[K] | undefined) => {
    if (candidate !== undefined) patch[key] = candidate;
  };
  assign("name", input.name as OrbitPageProfile["name"] | undefined);
  assign("bio", input.bio as OrbitPageProfile["bio"] | undefined);
  assign("avatar", input.avatar as OrbitPageProfile["avatar"] | undefined);
  assign("social_links", firstDefined(input, "social_links", "socialLinks") as OrbitPageProfile["social_links"] | undefined);
  assign("show_avatar", firstDefined(input, "show_avatar", "showAvatar") as OrbitPageProfile["show_avatar"] | undefined);
  assign("name_font_size", firstDefined(input, "name_font_size", "nameFontSize") as OrbitPageProfile["name_font_size"] | undefined);
  assign("bio_font_size", firstDefined(input, "bio_font_size", "bioFontSize") as OrbitPageProfile["bio_font_size"] | undefined);
  assign("tab_title", firstDefined(input, "tab_title", "tabTitle") as OrbitPageProfile["tab_title"] | undefined);
  assign("meta_description", firstDefined(input, "meta_description", "metaDescription") as OrbitPageProfile["meta_description"] | undefined);
  assign("footer_text", firstDefined(input, "footer_text", "footerText") as OrbitPageProfile["footer_text"] | undefined);
  assign("favicon", input.favicon as OrbitPageProfile["favicon"] | undefined);
  assign("google_analytics_id", firstDefined(input, "google_analytics_id", "googleAnalyticsId") as OrbitPageProfile["google_analytics_id"] | undefined);
  assign("privacy_policy_url", firstDefined(input, "privacy_policy_url", "privacyPolicyUrl") as OrbitPageProfile["privacy_policy_url"] | undefined);
  assign("cookie_policy_url", firstDefined(input, "cookie_policy_url", "cookiePolicyUrl") as OrbitPageProfile["cookie_policy_url"] | undefined);
  assign("admin_onboarding_enabled", firstDefined(input, "admin_onboarding_enabled", "adminOnboardingEnabled") as OrbitPageProfile["admin_onboarding_enabled"] | undefined);
  assign("appearance", input.appearance as OrbitPageProfile["appearance"] | undefined);
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
