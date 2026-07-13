export type SaasPlanId = 'free' | 'starter' | 'pro' | 'agency';
export type SaasThemeAccess = 'essential' | 'premium' | 'advanced';
export type SaasAnalyticsAccess = 'basic-clicks' | 'standard' | 'advanced-ga4';
export type SaasSeoAccess = 'none' | 'basic' | 'advanced';

export interface SaasPlanEntitlements {
  personalizedUrl: boolean;
  maxBlocks: number | null;
  storageBytes: number | null;
  maxUploadBytes: number | null;
  maxVideoUploadBytes: number | null;
  badgeRequired: boolean;
  themes: SaasThemeAccess;
  analytics: SaasAnalyticsAccess;
  scheduling: boolean;
  seo: SaasSeoAccess;
  pages: number | null;
  collaborators: boolean;
  videoUploads: boolean;
  available: boolean;
}

export interface SaasPlanDefinition {
  id: SaasPlanId;
  name: string;
  priceMonthlyEur: number | null;
  description: string;
  entitlements: SaasPlanEntitlements;
}

export interface SaasWorkspaceUsage {
  blocks: number;
  storageBytes: number;
}

export interface SaasBillingContext {
  mode: 'test';
  manageUrl: string;
}
