import { z } from "zod";
import { boundedString, parseOrThrow } from "./primitives";

const PolicyUrlSchema = boundedString(500).trim().refine((value) => {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Policy URLs must be relative paths or secure HTTPS URLs.");

const CategorySchema = z.object({
  enabled: z.boolean(),
  title: boundedString(100).trim(),
  description: boundedString(1_000).trim()
}).strict();

const LegalPolicySchema = z.object({
  mode: z.enum(["external", "hosted", "embedded"]),
  externalUrl: PolicyUrlSchema.optional().default(""),
  hostedText: boundedString(50_000).trim().optional().default(""),
  hostedFileName: boundedString(500).trim().optional().default(""),
  embeddedCode: boundedString(20_000).trim().optional().default("")
}).strict();

const HardcodedSchema = z.object({
  policyVersion: boundedString(50).trim(),
  texts: z.object({
    title: boundedString(200).trim(),
    description: boundedString(2_000).trim(),
    acceptAll: boundedString(100).trim(),
    rejectAll: boundedString(100).trim(),
    managePreferences: boundedString(100).trim(),
    savePreferences: boundedString(100).trim(),
    reopenLabel: boundedString(100).trim(),
    privacyPolicyLinkText: boundedString(100).trim(),
    cookiePolicyLinkText: boundedString(100).trim()
  }).strict(),
  urls: z.object({
    privacyPolicy: PolicyUrlSchema,
    cookiePolicy: PolicyUrlSchema
  }).strict(),
  categories: z.object({
    preferences: CategorySchema,
    analytics: CategorySchema,
    marketing: CategorySchema
  }).strict(),
  layout: z.enum(["bottom-bar", "centered-modal", "corner-popup"]),
  theme: z.enum(["light", "dark", "auto"]),
  buttonPriority: z.enum(["equal", "reject-first"]),
  geoMode: z.enum(["global", "eu-only", "always"]),
  consentExpiryDays: z.number().int().min(1).max(3_650),
  reshowOnVersionChange: z.boolean(),
  legalFooterText: boundedString(500).trim()
}).strict();

const BuilderSchema = z.object({
  provider: z.enum(["iubenda", "cookiebot", "cookieyes", "onetrust", "custom"]),
  providerConfig: z.object({
    siteId: boundedString(200).trim().optional().default(""),
    cookiePolicyId: boundedString(200).trim().optional().default(""),
    scriptId: boundedString(200).trim().optional().default(""),
    headSnippet: boundedString(10_000).trim().optional().default(""),
    bodySnippet: boundedString(10_000).trim().optional().default(""),
    privacyPolicyUrl: PolicyUrlSchema.optional().default(""),
    cookiePolicyUrl: PolicyUrlSchema.optional().default("")
  }).strict(),
  reopenSelector: boundedString(200).trim()
}).strict();

export const OrbitPageConsentConfigSchema = z.object({
  mode: z.enum(["disabled", "hardcoded", "builder"]),
  enabled: z.boolean(),
  controller: z.object({
    name: boundedString(200).trim(),
    email: z.string().trim().email().max(254),
    country: boundedString(100).trim().optional().default(""),
    address: boundedString(500).trim().optional().default("")
  }).strict().optional(),
  legalPolicies: z.object({
    showFooterLinks: z.boolean(),
    privacyPolicy: LegalPolicySchema,
    cookiePolicy: LegalPolicySchema
  }).strict().optional(),
  hardcoded: HardcodedSchema.optional(),
  builder: BuilderSchema.optional()
}).strict().superRefine((config, context) => {
  if (config.enabled && config.mode === "hardcoded" && !config.hardcoded) {
    context.addIssue({ code: "custom", message: "Native consent settings are required.", path: ["hardcoded"] });
  }
  if (config.enabled && config.mode === "builder" && !config.builder) {
    context.addIssue({ code: "custom", message: "External CMP settings are required.", path: ["builder"] });
  }
});

export type OrbitPageConsentConfig = z.infer<typeof OrbitPageConsentConfigSchema>;

export const DEFAULT_ORBITPAGE_CONSENT_CONFIG: OrbitPageConsentConfig = {
  mode: "disabled",
  enabled: false
};

export function parseOrbitPageConsentConfig(value: unknown) {
  return parseOrThrow(
    OrbitPageConsentConfigSchema,
    value ?? DEFAULT_ORBITPAGE_CONSENT_CONFIG,
    "The privacy configuration contains invalid or unsupported data."
  );
}

export function normalizeStoredOrbitPageConsentConfig(value: unknown) {
  const parsed = OrbitPageConsentConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ORBITPAGE_CONSENT_CONFIG;
}
