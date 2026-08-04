/**
 * Minimal capabilities consumed by the shared editor when a host application
 * supplies persistence and entitlement decisions.
 *
 * Plan identifiers, prices, billing-provider modes and other commercial data
 * deliberately stay outside this public contract.
 */
export type HostedThemeAccess = 'essential' | 'premium' | 'advanced';
export type HostedAnalyticsAccess = 'basic-clicks' | 'standard' | 'advanced-ga4';
export type HostedSeoAccess = 'none' | 'basic' | 'advanced';

export interface HostedEditorEntitlements {
  maxBlocks: number | null;
  maxUploadBytes: number | null;
  maxVideoUploadBytes: number | null;
  badgeRequired: boolean;
  themes: HostedThemeAccess;
  analytics: HostedAnalyticsAccess;
  scheduling: boolean;
  seo: HostedSeoAccess;
  pages: number | null;
  videoUploads: boolean;
  nativeMenu: boolean;
  maxMenuItems: number | null;
}

export interface HostedEditorPlan {
  name: string;
  entitlements: HostedEditorEntitlements;
}

export interface HostedEditorUsage {
  blocks: number;
}

export interface HostedEditorBilling {
  manageUrl: string;
}
