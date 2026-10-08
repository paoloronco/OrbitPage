import type { ShopAppearance, ShopProductCardStyle } from './schema.js';
type ShopRenderProduct = {
  productId: string; type: 'digital' | 'service'; title: string; description: string;
  summary?: string; priceCents: number; sessionsIncluded?: number;
  cardStyle: ShopProductCardStyle; coverKey?: string | null;
  file: { filename: string } | null; files?: Array<{ filename: string }>;
};
export type ShopRenderInput = {
  username: string; title: string; canonicalUrl: string; products: ShopRenderProduct[];
  appearance: ShopAppearance; theme?: Record<string, unknown>;
  machineReadableEnabled?: boolean; previewOnly?: boolean; previewCoverUrls?: Record<string, string>;
  apiBaseUrl: string; newsletterEndpoint: string; newsletterUsername?: string; newsletterContentType?: string;
  coverUrlPrefix: string;
};
export function renderShopHtml(input: ShopRenderInput): string;
export function renderShopMarkdown(input: Pick<ShopRenderInput, 'title' | 'canonicalUrl' | 'products' | 'appearance'>): string;
export function renderShopPolicyHtml(input: { shopUrl: string; appearance: ShopAppearance; theme?: Record<string, unknown> }): string | null;
export function resolvedShopDesign(appearance: ShopAppearance, theme: Record<string, unknown>): {
  pageBackground: string; pageBackgroundSecondary: string; textColor: string; mutedColor: string;
  accentColor: string; buttonTextColor: string; cardBackground: string; cardTextColor: string;
  borderColor: string; cardRadius: number; fontFamily: string;
};
export type ShopPurchasePresentation = {
  name: string; url: string; logoUrl: string; supportEmail: string;
  design: ReturnType<typeof resolvedShopDesign>;
  cardEffect: ShopAppearance['cardEffect']; cardOpacity: number;
};
export function shopPurchasePresentation(input: {
  appearance: ShopAppearance; theme?: Record<string, unknown>; shopUrl: string; title?: string;
}): ShopPurchasePresentation;
export function shopPolicyLinks(appearance: ShopAppearance, canonicalUrl: string): {
  terms: string; digitalLicense: string; privacy: string; refunds: string; withdrawal: string;
};
export function buildShopHomeLinks(input: {
  links: Array<Record<string, unknown>>; enabled: boolean; appearance: ShopAppearance;
  previousAppearance?: ShopAppearance; shopUrl: string;
}): { links: Array<Record<string, unknown>>; changed: boolean };
