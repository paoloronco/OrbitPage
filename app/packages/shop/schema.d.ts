export type ShopAiDraft = { productId: string; type: "digital" | "service"; title: string; description: string; priceCents: number };
export type ShopLocale = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt' | 'nl' | 'pl' | 'tr' | 'ru' | 'ar' | 'zh' | 'ja' | 'ko';
export type ShopProductCardStyle = {
  backgroundColor: string | null; textColor: string | null;
  surfaceEffect: 'inherit' | 'solid' | 'transparent' | 'liquid-glass';
  alignment: 'inherit' | 'left' | 'center';
};
export type ShopIntakeQuestion = { id: string; prompt: string; required: boolean };
export type ShopProductInput = {
  productId?: string; type: 'digital' | 'service'; title: string; summary: string;
  description: string; fulfillmentText: string; bookingUrl: string; sessionsIncluded: number;
  intakeQuestions: ShopIntakeQuestion[]; priceCents: number; active: boolean;
  removedFileIds: string[]; cardStyle: ShopProductCardStyle;
};
export type ShopAppearance = {
  locale: ShopLocale; title: string; description: string;
  showTitle: boolean; showDescription: boolean;
  titleFontFamily: string | null; titleFontSize: number | null;
  titleFontWeight: 400 | 500 | 600 | 700 | 800; titleColor: string | null;
  descriptionFontFamily: string | null; descriptionFontSize: number | null;
  descriptionFontWeight: 400 | 500 | 600 | 700 | 800; descriptionColor: string | null;
  logoUrl: string; backLinkLabel: string; backLinkDescription: string; inheritPageTheme: boolean;
  pageBackground: string; textColor: string; mutedColor: string; accentColor: string;
  buttonTextColor: string; cardBackground: string; cardTextColor: string; borderColor: string;
  cardEffect: 'solid' | 'transparent' | 'liquid-glass'; cardOpacity: number;
  cardRadius: number; shadowIntensity: number; layout: 'grid' | 'list'; alignment: 'left' | 'center';
  showProductType: boolean; newsletterEnabled: boolean; homeLinkEnabled: boolean;
  homeLinkTitle: string; homeLinkDescription: string;
  sellerType: 'unset' | 'trader' | 'private'; sellerName: string; sellerEmail: string;
  sellerPhone: string; sellerAddress: string; sellerBusinessId: string;
  termsText: string; digitalLicenseText: string; privacyText: string; cookiePolicyText: string;
  refundPolicyText: string; withdrawalText: string; termsUrl: string; digitalLicenseUrl: string;
  privacyUrl: string; cookiePolicyUrl: string; refundPolicyUrl: string; withdrawalUrl: string;
  sellerSelfCertified: boolean;
  checkout: {
    phone: boolean; billingAddress: 'auto' | 'required'; businessName: 'off' | 'optional' | 'required';
    taxId: 'off' | 'optional' | 'if_supported';
    customFields: Array<{ key: string; label: string; type: 'text' | 'numeric'; required: boolean }>;
  };
};
export type ShopBuyerDetails = {
  businessName: string | null; phone: string | null;
  billingAddress: { line1: string | null; line2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null } | null;
  taxIds: Array<{ type: string; value: string }>;
  customFields: Array<{ key: string; label: string; value: string }>;
};
export type ShopEmailSettings = {
  mode: 'platform' | 'custom'; host: string; port: 465 | 587 | 2525; username: string;
  fromName: string; fromEmail: string; replyTo: string; passwordConfigured: boolean;
  configured: boolean; verifiedAt: string | null;
};
type InputSchema<T> = {
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
};
// Each runtime supplies its installed Zod and its own uploaded-logo boundary.
export function createShopSchemas(zod: unknown, isOwnedLogo: (value: string) => boolean): {
  shopAiDraftSchema: InputSchema<ShopAiDraft>;
  shopProductInputSchema: InputSchema<ShopProductInput>;
  shopAppearanceInputSchema: InputSchema<ShopAppearance>;
  normalizeShopAppearance(value: unknown): ShopAppearance;
  normalizeShopProductCardStyle(value: unknown): ShopProductCardStyle;
};
export function isSafeShopBookingUrl(value: string): boolean;

export function shopComplianceReady(appearance?: ShopAppearance | null): boolean;
