export function stripeTaxIdCollection(taxId: 'off' | 'optional' | 'if_supported'): { enabled: boolean; required?: 'if_supported' | 'never' };
export function stripeNameCollection(businessName: 'off' | 'optional' | 'required'): { individual: { enabled: boolean; optional: boolean }; business: { enabled: boolean; optional?: boolean } };
type PaymentOrder = {
  orderId: string; currency: string; amountTotal: number; amountSubtotal?: number;
  paidAt?: string | null; stripeCheckoutSessionId: string | null;
  stripePaymentIntentId?: string | null; stripeChargeId?: string | null;
};
type StripeId = string | { id: string } | null;
type PaymentSession = {
  id: string; metadata: Record<string, string> | null; mode: string; status: string | null;
  currency: string | null; amount_subtotal: number | null; amount_total: number | null;
  total_details: { amount_discount: number; amount_shipping: number | null; amount_tax: number } | null;
  payment_status: string; payment_intent: StripeId;
};
export function checkoutAmounts(order: PaymentOrder, session: PaymentSession): {
  amountSubtotal: number; amountDiscount: number; amountTotal: number;
};
export function stripeObjectId(value: StripeId): string | null;
export function assertCheckoutCharge(order: PaymentOrder, session: PaymentSession,
  intent: { id: string; latest_charge: StripeId; status: string; amount: number; amount_received: number; currency: string },
  charge: { id: string; payment_intent: StripeId; paid: boolean; captured: boolean; amount: number; currency: string }): void;
