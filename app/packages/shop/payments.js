export function stripeTaxIdCollection(taxId) {
  return taxId === 'off' ? { enabled: false } : { enabled: true, required: taxId === 'if_supported' ? 'if_supported' : 'never' };
}
export function stripeNameCollection(businessName) {
  return { individual: { enabled: true, optional: false },
    business: businessName === 'off' ? { enabled: false } : { enabled: true, optional: businessName !== 'required' } };
}

export function shopCheckoutCustomFields(checkout, submitted = []) {
  const fields = checkout.customFields;
  if (!Array.isArray(submitted) || submitted.length > 3
    || submitted.some(item => !Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string'
      || typeof item[1] !== 'string' || item[1].length > 255 || !fields.some(field => field.key === item[0]))
    || new Set(submitted.map(([key]) => key)).size !== submitted.length) {
    throw new Error('Invalid customer details. Reload the product and try again.');
  }
  return fields.map(field => {
    const value = (submitted.find(([key]) => key === field.key)?.[1] || '').trim();
    if (field.required && !value) throw new Error(`Complete the required field: ${field.label}.`);
    if (value && field.type === 'numeric' && !/^[0-9]+$/.test(value)) throw new Error(`Use numbers only for: ${field.label}.`);
    return { key: field.key, label: { type: 'custom', custom: field.label }, type: field.type, optional: !field.required,
      ...(value ? { [field.type]: { default_value: value } } : {}) };
  });
}

// The stored Session ID, not merchant-editable metadata, binds a payment to an order.
export function checkoutAmounts(order, session) {
  const subtotal = order.amountSubtotal ?? order.amountTotal;
  const discount = session.total_details?.amount_discount;
  const total = session.amount_total;
  if (session.id !== order.stripeCheckoutSessionId
    || session.metadata?.orbitpageOrderId !== order.orderId
    || session.mode !== 'payment' || session.status !== 'complete'
    || session.currency !== order.currency
    || ![subtotal, session.amount_subtotal, discount, total].every(Number.isSafeInteger)
    || subtotal < 0 || session.amount_subtotal !== subtotal
    || discount < 0 || discount > subtotal || total !== subtotal - discount
    || session.total_details.amount_tax !== 0 || (session.total_details.amount_shipping ?? 0) !== 0
    || (order.amountSubtotal !== undefined && order.paidAt && order.amountTotal !== total)) {
    throw new Error('Stripe Checkout amount or binding mismatch.');
  }
  if (total === 0
    ? !['paid', 'no_payment_required'].includes(session.payment_status) || session.payment_intent !== null
    : session.payment_status !== 'paid') {
    throw new Error('Stripe Checkout payment is not confirmed.');
  }
  return { amountSubtotal: subtotal, amountDiscount: discount, amountTotal: total };
}

export function stripeObjectId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

export function assertCheckoutCharge(order, session, intent, charge) {
  if (stripeObjectId(session.payment_intent) !== intent.id
    || stripeObjectId(intent.latest_charge) !== charge.id
    || stripeObjectId(charge.payment_intent) !== intent.id
    || (order.stripePaymentIntentId && order.stripePaymentIntentId !== intent.id)
    || (order.stripeChargeId && order.stripeChargeId !== charge.id)
    || intent.status !== 'succeeded' || charge.paid !== true || charge.captured !== true
    || intent.amount !== session.amount_total || intent.amount_received !== session.amount_total
    || intent.currency !== order.currency
    || charge.amount !== session.amount_total || charge.currency !== order.currency) {
    throw new Error('Stripe payment binding mismatch.');
  }
}
