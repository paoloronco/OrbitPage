import type { ShopCouponInput } from "./schema.js";
export type ShopCoupon = { id: string; code: string; active: boolean; discountType: "percent" | "amount"; discount: number; currency: string | null; timesRedeemed: number };
export type ShopStripeOverview = {
  accountId: string; accountName: string; livemode: boolean;
  available: Array<{ currency: string; amount: number }>; pending: Array<{ currency: string; amount: number }>;
  hasMore: boolean;
  transactions: Array<{ id: string; createdAt: string; type: string; amount: number; fee: number; net: number; currency: string }>;
};
export class ShopCouponError extends Error { status: number; code: string; }
export function listStripeShopCoupons(client: unknown, options: { stripeAccount?: string }): Promise<{ coupons: ShopCoupon[]; hasMore: boolean }>;
export function createStripeShopCoupon(client: unknown, options: { stripeAccount?: string }, input: ShopCouponInput, namespace: string): Promise<ShopCoupon>;
export function readStripeShopOverview(client: unknown, options: { stripeAccount?: string }, accountId: string, accountName: string): Promise<ShopStripeOverview>;
