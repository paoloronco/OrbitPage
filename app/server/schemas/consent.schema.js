import { z } from 'zod';

export const CategoryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().max(100).default(''),
  description: z.string().max(1000).default(''),
});

export const HardcodedTextsSchema = z.object({
  title: z.string().max(200).default('We value your privacy'),
  description: z.string().max(2000).default(''),
  acceptAll: z.string().max(100).default('Accept all'),
  rejectAll: z.string().max(100).default('Reject all'),
  managePreferences: z.string().max(100).default('Manage preferences'),
  savePreferences: z.string().max(100).default('Save preferences'),
  reopenLabel: z.string().max(100).default('Cookie preferences'),
  privacyPolicyLinkText: z.string().max(100).default('Privacy policy'),
  cookiePolicyLinkText: z.string().max(100).default('Cookie policy'),
});

export const HardcodedConfigSchema = z.object({
  policyVersion: z.string().max(50).default('1.0'),
  texts: HardcodedTextsSchema.default({}),
  urls: z.object({
    privacyPolicy: z.string().max(500).default(''),
    cookiePolicy: z.string().max(500).default(''),
  }).default({}),
  categories: z.object({
    preferences: CategoryConfigSchema.default({}),
    analytics: CategoryConfigSchema.default({}),
    marketing: CategoryConfigSchema.default({}),
  }).default({}),
  layout: z.enum(['bottom-bar', 'centered-modal', 'corner-popup']).default('bottom-bar'),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  buttonPriority: z.enum(['equal', 'reject-first']).default('equal'),
  geoMode: z.enum(['global', 'eu-only', 'always']).default('eu-only'),
  consentExpiryDays: z.number().int().min(1).max(3650).default(365),
  reshowOnVersionChange: z.boolean().default(true),
  legalFooterText: z.string().max(500).default(''),
});

export const LegalPolicySchema = z.object({
  mode: z.enum(['external', 'hosted', 'embedded']).default('external'),
  externalUrl: z.string().max(500).default(''),
  hostedText: z.string().max(50000).default(''),
  hostedFileName: z.string().max(500).default(''),
  embeddedCode: z.string().max(20000).default(''),
});

export const LegalPoliciesSchema = z.object({
  showFooterLinks: z.boolean().default(false),
  privacyPolicy: LegalPolicySchema.default({}),
  cookiePolicy: LegalPolicySchema.default({}),
}).default({});

export const BuilderProviderConfigSchema = z.object({
  siteId: z.string().max(200).default(''),
  cookiePolicyId: z.string().max(200).default(''),
  scriptId: z.string().max(200).default(''),
  headSnippet: z.string().max(10000).default(''),
  bodySnippet: z.string().max(10000).default(''),
  privacyPolicyUrl: z.string().max(500).default(''),
  cookiePolicyUrl: z.string().max(500).default(''),
});

export const BuilderConfigSchema = z.object({
  provider: z.enum(['iubenda', 'cookiebot', 'cookieyes', 'onetrust', 'custom']).default('custom'),
  providerConfig: BuilderProviderConfigSchema.default({}),
  reopenSelector: z.string().max(200).default(''),
});

export const ConsentConfigBodySchema = z.object({
  mode: z.enum(['disabled', 'hardcoded', 'builder']),
  enabled: z.boolean(),
  legalPolicies: LegalPoliciesSchema.optional().default({}),
  hardcoded: HardcodedConfigSchema.optional().default({}),
  builder: BuilderConfigSchema.optional().default({}),
});
