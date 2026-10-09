export type ShopEmailMessage = { to: string; replyTo?: string; subject: string; text: string; html: string };
export type ShopEmailOrder = {
  orderId: string; orderNumber?: number; productTitle: string; productType: 'digital' | 'service'; amountTotal: number; currency: 'eur'; buyerEmail: string;
  sellerType?: 'unset' | 'trader' | 'private'; sellerName?: string; sellerEmail?: string; sellerPhone?: string; sellerAddress?: string;
  sellerBusinessId?: string; sellerTermsUrl?: string; sellerDigitalLicenseUrl?: string; sellerPrivacyUrl?: string; sellerRefundPolicyUrl?: string;
  sellerWithdrawalUrl?: string; sellerTermsAcceptedAt?: string; sellerNoticeAcknowledgedAt?: string; digitalContentConsentAt?: string | null;
  fulfillmentText?: string; bookingUrl?: string;
};
export function buildShopBuyerEmail(input: { order: ShopEmailOrder; deliveryUrl: string; customerPortalUrl?: string; sellerEmail?: string }): ShopEmailMessage;
export function buildShopSellerEmail(input: { order: ShopEmailOrder; sellerEmail: string; shopName: string; dashboardUrl: string }): ShopEmailMessage;
