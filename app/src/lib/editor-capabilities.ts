/**
 * Minimal capabilities consumed by the shared editor when a host application
 * supplies persistence and entitlement decisions.
 *
 * Plan identifiers, prices, billing-provider modes and other commercial data
 * deliberately stay outside this public contract.
 */
export type EditorThemeAccess = 'essential' | 'premium' | 'advanced';
export type EditorAnalyticsAccess = 'basic-clicks' | 'standard' | 'advanced-ga4';
export type EditorSeoAccess = 'none' | 'basic' | 'advanced';

export interface EditorEntitlements {
  maxBlocks: number | null;
  maxUploadBytes: number | null;
  maxVideoUploadBytes: number | null;
  badgeRequired: boolean;
  themes: EditorThemeAccess;
  analytics: EditorAnalyticsAccess;
  scheduling: boolean;
  seo: EditorSeoAccess;
  pages: number | null;
  videoUploads: boolean;
  nativeMenu: boolean;
  maxMenuItems: number | null;
}

export interface EditorAccess {
  name: string;
  entitlements: EditorEntitlements;
}

export interface EditorUsage {
  blocks: number;
}

export interface EditorActions {
  manageUrl: string;
}
