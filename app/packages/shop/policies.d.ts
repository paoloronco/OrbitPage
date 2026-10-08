export const SHOP_POLICIES: readonly [
  { slug: 'terms'; title: 'Terms'; textField: 'termsText'; urlField: 'termsUrl' },
  { slug: 'digital-license'; title: 'Digital Product & License Terms'; textField: 'digitalLicenseText'; urlField: 'digitalLicenseUrl' },
  { slug: 'privacy'; title: 'Privacy policy'; textField: 'privacyText'; urlField: 'privacyUrl' },
  { slug: 'cookies'; title: 'Cookie policy'; textField: 'cookiePolicyText'; urlField: 'cookiePolicyUrl' },
  { slug: 'refunds'; title: 'Refund policy'; textField: 'refundPolicyText'; urlField: 'refundPolicyUrl' },
  { slug: 'withdrawal'; title: 'Withdrawal and contact'; textField: 'withdrawalText'; urlField: 'withdrawalUrl' }
];
type ShopPolicy = typeof SHOP_POLICIES[number];
export function shopPolicies(appearance: Record<ShopPolicy['textField' | 'urlField'], string>, shopUrl: string): Array<ShopPolicy & { text: string; url: string }>;
