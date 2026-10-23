import type { ShopAppearance } from "./schema.js";
import type { ShopCheckoutAcknowledgement, ShopBuyerAcknowledgement } from "./schema.js";
export function shopCheckoutAcknowledgements(appearance: Pick<ShopAppearance, 'checkoutAcknowledgements'>, productType: 'digital' | 'service'): ShopCheckoutAcknowledgement[];
export function shopBuyerAcknowledgements(appearance: Pick<ShopAppearance, 'checkoutAcknowledgements'>, productType: 'digital' | 'service', accepted?: string[]): ShopBuyerAcknowledgement[];
export const SHOP_POLICIES: readonly [
  { slug: 'terms'; title: 'Terms'; textField: 'termsText'; urlField: 'termsUrl'; footerField: 'showTermsInFooter' },
  { slug: 'digital-license'; title: 'Digital Product & License Terms'; textField: 'digitalLicenseText'; urlField: 'digitalLicenseUrl'; footerField: 'showDigitalLicenseInFooter' },
  { slug: 'privacy'; title: 'Privacy policy'; textField: 'privacyText'; urlField: 'privacyUrl'; footerField: 'showPrivacyInFooter' },
  { slug: 'cookies'; title: 'Cookie policy'; textField: 'cookiePolicyText'; urlField: 'cookiePolicyUrl'; footerField: 'showCookiesInFooter' },
  { slug: 'refunds'; title: 'Refund policy'; textField: 'refundPolicyText'; urlField: 'refundPolicyUrl'; footerField: 'showRefundsInFooter' },
  { slug: 'withdrawal'; title: 'Withdrawal and contact'; textField: 'withdrawalText'; urlField: 'withdrawalUrl'; footerField: 'showWithdrawalInFooter' }
];
type ShopPolicy = typeof SHOP_POLICIES[number];
export function shopPolicies(appearance: Record<ShopPolicy['textField' | 'urlField'], string>, shopUrl: string): Array<ShopPolicy & { text: string; url: string }>;
export function shopSellerNotice(appearance: Pick<ShopAppearance, 'sellerType' | 'sellerNoticeAddon'>): string;
export function shopDigitalContentConsent(appearance: Pick<ShopAppearance, 'digitalContentConsentAddon'>): string;
