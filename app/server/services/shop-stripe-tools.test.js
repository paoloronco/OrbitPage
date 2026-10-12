import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createShopSchemas } from '../../packages/shop/schema.js';
import { createStripeShopCoupon, listStripeShopCoupons, readStripeShopOverview, ShopCouponError } from '../../packages/shop/stripe.js';

const coupon = { id: 'coupon_fixture', percent_off: 10, amount_off: null, currency: null };
const promotion = { id: 'promo_fixture', code: 'WELCOME10', active: true, times_redeemed: 2, metadata: { orbitpageShop: 'owner' }, promotion: { type: 'coupon', coupon } };
const options = { stripeAccount: 'acct_fixture' };
function client() {
  return {
    promotionCodes: { list: vi.fn(async () => ({ data: [], has_more: false })), create: vi.fn(async () => promotion) },
    coupons: { create: vi.fn(async () => coupon) },
    balance: { retrieve: vi.fn(async () => ({ livemode: false, available: [{ amount: 1200, currency: 'eur', source_types: { card: 1200 } }], pending: [{ amount: 500, currency: 'eur' }] })) },
    balanceTransactions: { list: vi.fn(async () => ({ has_more: true, data: [{ id: 'txn_fixture', created: 1700000000, type: 'charge', amount: 2000, fee: 60, net: 1940, currency: 'eur', description: 'Private buyer name', source: { email: 'buyer@example.invalid' } }] })) },
  };
}
describe('Shop Stripe tools', () => {
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
