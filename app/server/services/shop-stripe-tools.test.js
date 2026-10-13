import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createShopSchemas } from '../../packages/shop/schema.js';
import { createStripeShopCoupon, listStripeShopCoupons, revokeStripeShopCoupon, readStripeShopOverview, ShopCouponError } from '../../packages/shop/stripe.js';

const coupon = { id: 'coupon_fixture', percent_off: 10, amount_off: null, currency: null, metadata: { orbitpageShop: 'owner' } };
const promotion = { id: 'promo_fixture', code: 'WELCOME10', active: true, times_redeemed: 2, metadata: { orbitpageShop: 'owner' }, promotion: { type: 'coupon', coupon } };
const options = { stripeAccount: 'acct_fixture' };
function client() {
  return {
    promotionCodes: { list: vi.fn(async () => ({ data: [], has_more: false })), create: vi.fn(async () => promotion), retrieve: vi.fn(async () => promotion), update: vi.fn(async () => ({ ...promotion, active: false })) },
    coupons: { create: vi.fn(async () => coupon), del: vi.fn(async () => ({ id: coupon.id, deleted: true })) },
    balance: { retrieve: vi.fn(async () => ({ livemode: false, available: [{ amount: 1200, currency: 'eur', source_types: { card: 1200 } }], pending: [{ amount: 500, currency: 'eur' }] })) },
    balanceTransactions: { list: vi.fn(async () => ({ has_more: true, data: [{ id: 'txn_fixture', created: 1700000000, type: 'charge', amount: 2000, fee: 60, net: 1940, currency: 'eur', description: 'Private buyer name', source: { email: 'buyer@example.invalid' } }] })) },
  };
}
describe('Shop Stripe tools', () => {
  it('validates limits and sends them to Stripe with distinct retry keys', async () => {
    const { shopCouponInputSchema } = createShopSchemas(z, () => false);
    const base = { code: 'LIMITED', discountType: 'percent', discount: 10 };
    for (const limits of [{ maxRedemptions: 0 }, { maxRedemptions: 1.5 }, { expiresAt: 1 }, { expiresAt: 999999999999 }]) expect(shopCouponInputSchema.safeParse({ ...base, ...limits }).success).toBe(false);
    const input = shopCouponInputSchema.parse({ ...base, maxRedemptions: 5, expiresAt: Math.floor(Date.now() / 1000) + 86400 });
    const stripe = client();
    await createStripeShopCoupon(stripe, options, input, 'owner');
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(expect.objectContaining({ max_redemptions: 5, expires_at: input.expiresAt }), expect.objectContaining(options));
    const key = stripe.coupons.create.mock.calls[0][1].idempotencyKey;
    await createStripeShopCoupon(stripe, options, { ...input, maxRedemptions: 6 }, 'owner');
    expect(stripe.coupons.create.mock.calls[1][1].idempotencyKey).not.toBe(key);
    stripe.promotionCodes.list.mockResolvedValue({ data: [{ ...promotion, max_redemptions: 5, expires_at: input.expiresAt }] });
    await expect(createStripeShopCoupon(stripe, options, input, 'owner')).resolves.toMatchObject({ maxRedemptions: 5, expiresAt: input.expiresAt });
    await expect(createStripeShopCoupon(stripe, options, { ...input, maxRedemptions: 6 }, 'owner')).rejects.toBeInstanceOf(ShopCouponError);
  });
  it('revokes and deletes only this Shop coupons using the owning account', async () => {
    const stripe = client();
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner')).resolves.toMatchObject({ active: false });
    expect(stripe.promotionCodes.retrieve).toHaveBeenCalledWith(promotion.id, { expand: ['promotion.coupon'] }, options);
    expect(stripe.promotionCodes.update).toHaveBeenCalledWith(promotion.id, { active: false }, options);
    expect(stripe.coupons.del).not.toHaveBeenCalled();
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'other-owner', true)).rejects.toMatchObject({ status: 403 });
    expect(stripe.coupons.del).not.toHaveBeenCalled();
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner', true)).resolves.toEqual({ id: promotion.id, deleted: true });
    expect(stripe.coupons.del).toHaveBeenCalledWith(coupon.id, options);
    stripe.promotionCodes.retrieve.mockResolvedValue({ ...promotion, promotion: { coupon: { id: coupon.id, deleted: true } } });
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner', true)).resolves.toMatchObject({ deleted: true });
    expect(stripe.coupons.del).toHaveBeenCalledTimes(1);
  });
  it('rejects foreign discounts even when the promotion has this Shop namespace', async () => {
    const stripe = client();
    stripe.promotionCodes.retrieve.mockResolvedValue({ ...promotion, promotion: { coupon: { ...coupon, metadata: {} } } });
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner', true)).rejects.toMatchObject({ status: 403 });
    expect(stripe.promotionCodes.update).not.toHaveBeenCalled();
    expect(stripe.coupons.del).not.toHaveBeenCalled();
    await expect(revokeStripeShopCoupon(stripe, options, '../another', 'owner')).rejects.toMatchObject({ status: 400 });
  });
  it('hides deleted discounts and leaves foreign codes read-only', async () => {
    const stripe = client();
    stripe.promotionCodes.list.mockResolvedValue({ data: [promotion, { ...promotion, id: 'promo_other', metadata: {} }, { ...promotion, promotion: { coupon: { deleted: true } } }], has_more: true });
    const result = await listStripeShopCoupons(stripe, options, 'owner');
    expect(result.coupons.map(item => item.manageable)).toEqual([true, false]);
    expect(result.hasMore).toBe(true);
  });
  it('does not delete a discount shared with another promotion code', async () => {
    const stripe = client();
    stripe.promotionCodes.list.mockResolvedValue({ data: [promotion, { id: 'promo_another' }], has_more: false });
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner', true)).rejects.toMatchObject({ code: 'SHOP_COUPON_SHARED' });
    expect(stripe.promotionCodes.update).not.toHaveBeenCalled();
    expect(stripe.coupons.del).not.toHaveBeenCalled();
  });
  it('keeps deleted codes hidden even when Stripe retains the expanded discount', async () => {
    const stripe = client();
    stripe.coupons.del.mockRejectedValueOnce({ code: 'resource_missing' });
    await expect(revokeStripeShopCoupon(stripe, options, promotion.id, 'owner', true)).resolves.toMatchObject({ deleted: true });
    expect(stripe.promotionCodes.update).toHaveBeenLastCalledWith(promotion.id, { metadata: { orbitpageDeleted: 'true' } }, options);
    stripe.promotionCodes.list.mockResolvedValue({ data: [{ ...promotion, active: false, metadata: { ...promotion.metadata, orbitpageDeleted: 'true' } }], has_more: false });
    expect((await listStripeShopCoupons(stripe, options, 'owner')).coupons).toEqual([]);
  });
  it('creates a fresh discount after revocation and preserves retry stability', async () => {
    const stripe = client(), input = { code: 'WELCOME10', discountType: 'percent', discount: 10 };
    await createStripeShopCoupon(stripe, options, input, 'owner');
    const oldKey = stripe.coupons.create.mock.calls[0][1].idempotencyKey;
    stripe.promotionCodes.list.mockResolvedValue({ data: [{ ...promotion, active: false }] });
    await createStripeShopCoupon(stripe, options, input, 'owner');
    await createStripeShopCoupon(stripe, options, input, 'owner');
    expect(stripe.coupons.create.mock.calls[1][1].idempotencyKey).not.toBe(oldKey);
    expect(stripe.coupons.create.mock.calls[2][1].idempotencyKey).toBe(stripe.coupons.create.mock.calls[1][1].idempotencyKey);
  });
  it('binds fixed discounts and idempotent retries to their original currency', async () => {
    const stripe = client();
    const input = { code: 'SAVE5', discountType: 'amount', discount: 500, currency: 'usd' };
    await createStripeShopCoupon(stripe, options, input, 'owner');
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 500, currency: 'usd' }), expect.objectContaining(options));
    const usdKey = stripe.coupons.create.mock.calls[0][1].idempotencyKey;
    await createStripeShopCoupon(stripe, options, { ...input, currency: 'gbp' }, 'owner');
    expect(stripe.coupons.create.mock.calls[1][1].idempotencyKey).not.toBe(usdKey);
    stripe.promotionCodes.list.mockResolvedValue({ data: [{ ...promotion, promotion: { coupon: { ...coupon, percent_off: null, amount_off: 500, currency: 'usd' } } }] });
    await expect(createStripeShopCoupon(stripe, options, input, 'owner')).resolves.toMatchObject({ currency: 'usd' });
    await expect(createStripeShopCoupon(stripe, options, { ...input, currency: 'gbp' }, 'owner')).rejects.toBeInstanceOf(ShopCouponError);
  });
  it('bounds discounts and normalizes customer-facing codes', () => {
    const { shopCouponInputSchema } = createShopSchemas(z, () => false);
    expect(shopCouponInputSchema.parse({ code: ' welcome10 ', discountType: 'percent', discount: 10 }).code).toBe('WELCOME10');
    for (const input of [{ code: '<script>', discountType: 'percent', discount: 10 }, { code: 'FREE', discountType: 'percent', discount: 101 }, { code: 'OFF', discountType: 'amount', discount: 1.5 }, { code: 'OFF', discountType: 'percent', discount: 10, stripeAccount: 'another-account' }]) expect(shopCouponInputSchema.safeParse(input).success).toBe(false);
  });
  it('scopes both provider writes and retries to the same account', async () => {
    const stripe = client();
    const input = { code: 'WELCOME10', discountType: 'percent', discount: 10 };
    expect(await createStripeShopCoupon(stripe, options, input, 'owner')).toMatchObject({ code: 'WELCOME10', discount: 10, discountType: 'percent' });
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ percent_off: 10, metadata: { orbitpageShop: 'owner' } }), expect.objectContaining({ ...options, idempotencyKey: expect.any(String) }));
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(expect.objectContaining({ promotion: { type: 'coupon', coupon: coupon.id } }), expect.objectContaining(options));
    const firstKey = stripe.coupons.create.mock.calls[0][1].idempotencyKey;
    await createStripeShopCoupon(stripe, options, input, 'owner');
    expect(stripe.coupons.create.mock.calls[1][1].idempotencyKey).toBe(firstKey);
  });
  it('recovers an existing matching code and rejects another account namespace or discount', async () => {
    const stripe = client(); stripe.promotionCodes.list.mockResolvedValue({ data: [promotion], has_more: false });
    await createStripeShopCoupon(stripe, options, { code: 'WELCOME10', discountType: 'percent', discount: 10 }, 'owner');
    expect(stripe.coupons.create).not.toHaveBeenCalled();
    await expect(createStripeShopCoupon(stripe, options, { code: 'WELCOME10', discountType: 'percent', discount: 20 }, 'owner')).rejects.toBeInstanceOf(ShopCouponError);
    await expect(createStripeShopCoupon(stripe, options, { code: 'WELCOME10', discountType: 'percent', discount: 10 }, 'other-owner')).rejects.toBeInstanceOf(ShopCouponError);
    expect((await listStripeShopCoupons(stripe, options)).coupons).toHaveLength(1);
    expect(stripe.promotionCodes.list).toHaveBeenLastCalledWith({ limit: 50, expand: ['data.promotion.coupon'] }, options);
  });
  it('returns bounded account activity without identities or payment credentials', async () => {
    const stripe = client(), result = await readStripeShopOverview(stripe, options, 'acct_fixture', 'Fictional seller');
    expect(stripe.balance.retrieve).toHaveBeenCalledWith({}, options);
    expect(stripe.balanceTransactions.list).toHaveBeenCalledWith({ limit: 50 }, options);
    expect(result.transactions[0]).toMatchObject({ amount: 2000, fee: 60, net: 1940, currency: 'eur' });
    expect(JSON.stringify(result)).not.toMatch(/Private buyer|buyer@example|source_types/);
  });
});
