export class ShopCouponError extends Error {
  status = 409;
  code = "SHOP_COUPON_CODE_EXISTS";
  constructor(message = "This coupon code is already in use. Choose another code.", status = 409, code = "SHOP_COUPON_CODE_EXISTS") { super(message); this.status = status; this.code = code; }
}

function couponDto(promotion, coupon = promotion.promotion.coupon, namespace) {
  return {
    id: promotion.id, code: promotion.code, active: promotion.active,
    discountType: coupon.percent_off !== null ? "percent" : "amount",
    discount: coupon.percent_off ?? coupon.amount_off,
    currency: coupon.currency, timesRedeemed: promotion.times_redeemed,
    maxRedemptions: promotion.max_redemptions ?? null, expiresAt: promotion.expires_at ?? null,
    manageable: Boolean(namespace && promotion.metadata?.orbitpageShop === namespace && coupon.metadata?.orbitpageShop === namespace),
  };
}

export async function listStripeShopCoupons(client, options, namespace) {
  const result = await client.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] }, options);
  return { coupons: result.data.filter(promotion => !promotion.promotion.coupon.deleted).map(promotion => couponDto(promotion, undefined, namespace)), hasMore: result.has_more };
}

export async function createStripeShopCoupon(client, options, input, namespace) {
  const existing = await client.promotionCodes.list({ code: input.code, limit: 1, expand: ["data.promotion.coupon"] }, options);
  if (existing.data[0]?.active) {
    const promotion = existing.data[0], coupon = couponDto(promotion, undefined, namespace);
    if (promotion.metadata.orbitpageShop !== namespace || coupon.discountType !== input.discountType || coupon.discount !== input.discount || coupon.maxRedemptions !== (input.maxRedemptions ?? null) || coupon.expiresAt !== (input.expiresAt ?? null) || (input.discountType === "amount" && coupon.currency !== (input.currency || "eur"))) throw new ShopCouponError();
    return coupon;
  }
  // Stable keys recover both provider writes when a response is lost.
  const key = `orbitpage-shop-coupon-${namespace}-${input.code}-${input.discountType}-${input.discount}${input.discountType === "amount" && input.currency && input.currency !== "eur" ? `-${input.currency}` : ""}${input.maxRedemptions ? `-max${input.maxRedemptions}` : ""}${input.expiresAt ? `-exp${input.expiresAt}` : ""}${existing.data[0] ? `-${existing.data[0].id}` : ""}`;
  const coupon = await client.coupons.create({ duration: "once", name: input.code,
    ...(input.discountType === "percent" ? { percent_off: input.discount } : { amount_off: input.discount, currency: input.currency || "eur" }),
    metadata: { orbitpageShop: namespace },
  }, { ...options, idempotencyKey: `${key}-discount` });
  const promotion = await client.promotionCodes.create({ code: input.code, promotion: { type: "coupon", coupon: coupon.id }, metadata: { orbitpageShop: namespace },
    ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}), ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
  },
    { ...options, idempotencyKey: `${key}-code` });
  return couponDto(promotion, coupon, namespace);
}

export async function revokeStripeShopCoupon(client, options, id, namespace, remove = false) {
  if (!/^promo_[a-zA-Z0-9_]{1,120}$/.test(id)) throw new ShopCouponError("Invalid coupon code.", 400, "INVALID_SHOP_COUPON");
  const promotion = await client.promotionCodes.retrieve(id, { expand: ["promotion.coupon"] }, options);
  const coupon = promotion.promotion.coupon;
  if (promotion.metadata?.orbitpageShop !== namespace || (!coupon.deleted && coupon.metadata?.orbitpageShop !== namespace)) {
    throw new ShopCouponError("Manage this code in Stripe. It was not created by this Shop.", 403, "SHOP_COUPON_NOT_OWNED");
  }
  if (coupon.deleted) return { id, deleted: true };
  if (remove) {
    const linked = await client.promotionCodes.list({ coupon: coupon.id, limit: 2 }, options);
    if (linked.data.some(code => code.id !== id) || linked.has_more) throw new ShopCouponError("Other codes use this discount. Revoke this code or manage the discount in Stripe.", 409, "SHOP_COUPON_SHARED");
  }
  const updated = promotion.active ? await client.promotionCodes.update(id, { active: false }, options) : promotion;
  if (remove) {
    await client.coupons.del(coupon.id, options);
    return { id, deleted: true };
  }
  return couponDto(updated, coupon, namespace);
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
