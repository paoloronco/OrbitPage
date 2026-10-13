import type { ShopCouponInput } from "./schema.js";
export type ShopCoupon = { id: string; code: string; active: boolean; discountType: "percent" | "amount"; discount: number; currency: string | null; timesRedeemed: number; maxRedemptions: number | null; expiresAt: number | null; manageable: boolean };
export type ShopStripeOverview = {
  accountId: string; accountName: string; livemode: boolean;
  available: Array<{ currency: string; amount: number }>; pending: Array<{ currency: string; amount: number }>;
  hasMore: boolean;
  transactions: Array<{ id: string; createdAt: string; type: string; amount: number; fee: number; net: number; currency: string }>;
};
export class ShopCouponError extends Error { status: number; code: string; }
export function listStripeShopCoupons(client: unknown, options: { stripeAccount?: string }, namespace: string): Promise<{ coupons: ShopCoupon[]; hasMore: boolean }>;
export function revokeStripeShopCoupon(client: unknown, options: { stripeAccount?: string }, id: string, namespace: string, remove?: boolean): Promise<ShopCoupon | { id: string; deleted: true }>;
export function createStripeShopCoupon(client: unknown, options: { stripeAccount?: string }, input: ShopCouponInput, namespace: string): Promise<ShopCoupon>;
export function readStripeShopOverview(client: unknown, options: { stripeAccount?: string }, accountId: string, accountName: string): Promise<ShopStripeOverview>;
