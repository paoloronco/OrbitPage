export class ShopCouponError extends Error {
  status = 409;
  code = "SHOP_COUPON_CODE_EXISTS";
  constructor() { super("This coupon code is already in use. Choose another code."); }
}

function couponDto(promotion, coupon = promotion.promotion.coupon) {
  return {
    id: promotion.id, code: promotion.code, active: promotion.active,
    discountType: coupon.percent_off !== null ? "percent" : "amount",
    discount: coupon.percent_off ?? coupon.amount_off,
    currency: coupon.currency, timesRedeemed: promotion.times_redeemed,
  };
}

export async function listStripeShopCoupons(client, options) {
  const result = await client.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] }, options);
  return { coupons: result.data.map(promotion => couponDto(promotion)), hasMore: result.has_more };
}

export async function createStripeShopCoupon(client, options, input, namespace) {
  const existing = await client.promotionCodes.list({ code: input.code, active: true, limit: 1, expand: ["data.promotion.coupon"] }, options);
  if (existing.data.length) {
    const promotion = existing.data[0], coupon = couponDto(promotion);
    if (promotion.metadata.orbitpageShop !== namespace || coupon.discountType !== input.discountType || coupon.discount !== input.discount) throw new ShopCouponError();
    return coupon;
  }
  // Stable keys recover both provider writes when a response is lost.
  const key = `orbitpage-shop-coupon-${namespace}-${input.code}-${input.discountType}-${input.discount}`;
  const coupon = await client.coupons.create({ duration: "once", name: input.code,
    ...(input.discountType === "percent" ? { percent_off: input.discount } : { amount_off: input.discount, currency: "eur" }),
    metadata: { orbitpageShop: namespace },
  }, { ...options, idempotencyKey: `${key}-discount` });
  const promotion = await client.promotionCodes.create({ code: input.code, promotion: { type: "coupon", coupon: coupon.id }, metadata: { orbitpageShop: namespace } },
    { ...options, idempotencyKey: `${key}-code` });
  return couponDto(promotion, coupon);
}

export async function readStripeShopOverview(client, options, accountId, accountName) {
  const [balance, activity] = await Promise.all([
    client.balance.retrieve({}, options), client.balanceTransactions.list({ limit: 50 }, options),
  ]);
  const amounts = items => items.map(({ currency, amount }) => ({ currency, amount }));
  return { accountId, accountName, livemode: balance.livemode,
    available: amounts(balance.available), pending: amounts(balance.pending), hasMore: activity.has_more,
    transactions: activity.data.map(({ id, created, type, amount, fee, net, currency }) => ({ id, createdAt: new Date(created * 1000).toISOString(), type, amount, fee, net, currency })),
  };
}
