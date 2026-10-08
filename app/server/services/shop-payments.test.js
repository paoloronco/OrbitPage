import { describe, expect, it } from 'vitest';
import { checkoutAmounts, assertCheckoutCharge, stripeTaxIdCollection, stripeNameCollection } from '../../packages/shop/payments.js';

const order = { orderId: 'order', currency: 'eur', amountTotal: 2000, stripeCheckoutSessionId: 'cs_1' };
const session = {
  id: 'cs_1', mode: 'payment', status: 'complete', currency: 'eur',
  metadata: { orbitpageOrderId: 'order' }, amount_subtotal: 2000, amount_total: 1500,
  total_details: { amount_discount: 500, amount_tax: 0, amount_shipping: 0 },
  payment_status: 'paid', payment_intent: 'pi_1'
};

describe('shared Checkout verification', () => {
  it('omits Stripe required tax-ID settings when collection is disabled', () => {
    expect(stripeTaxIdCollection('off')).toEqual({ enabled: false });
    expect(stripeTaxIdCollection('optional')).toEqual({ enabled: true, required: 'never' });
    expect(stripeTaxIdCollection('if_supported')).toEqual({ enabled: true, required: 'if_supported' });
  });
  it('omits the optional business-name setting when collection is disabled', () => {
    expect(stripeNameCollection('off').business).toEqual({ enabled: false });
    expect(stripeNameCollection('optional').business).toEqual({ enabled: true, optional: true });
    expect(stripeNameCollection('required').business).toEqual({ enabled: true, optional: false });
  });
  it('records a Stripe discount against the original purchase snapshot, including legacy orders', () => {
    expect(checkoutAmounts(order, session)).toEqual({ amountSubtotal: 2000, amountDiscount: 500, amountTotal: 1500 });
    expect(checkoutAmounts({ ...order, amountSubtotal: 2000, amountTotal: 1500, paidAt: 'paid' }, session).amountTotal).toBe(1500);
  });
  it.each([
    { id: 'cs_other' }, { metadata: { orbitpageOrderId: 'other' } }, { mode: 'setup' },
    { status: 'open' }, { currency: 'usd' }, { amount_subtotal: 1500 }, { amount_total: 1499 },
    { amount_total: -1 }, { payment_status: 'unpaid' }, { total_details: null },
    { total_details: { amount_discount: 500, amount_tax: 1, amount_shipping: 0 } },
    { total_details: { amount_discount: -1, amount_tax: 0, amount_shipping: 0 } }
  ])('rejects altered, incomplete or unconfirmed Checkout: %j', change => {
    expect(() => checkoutAmounts(order, { ...session, ...change })).toThrow();
  });
  it.each(['paid', 'no_payment_required'])('accepts a completed 100%% coupon with %s and no PaymentIntent', payment_status => {
    const free = { ...session, amount_total: 0, payment_status, payment_intent: null,
      total_details: { ...session.total_details, amount_discount: 2000 } };
    expect(checkoutAmounts(order, free).amountTotal).toBe(0);
    expect(() => checkoutAmounts(order, { ...free, mode: 'setup' })).toThrow();
    expect(() => checkoutAmounts(order, { ...free, payment_intent: 'pi_1' })).toThrow();
    expect(() => checkoutAmounts(order, { ...free, payment_status: 'unpaid' })).toThrow();
  });
  it('cannot replace a settled amount with a different discount', () => {
    expect(() => checkoutAmounts({ ...order, amountSubtotal: 2000, amountTotal: 1600, paidAt: 'paid' }, session)).toThrow();
  });
  it('binds captured funds to the Checkout, PaymentIntent, charge and any previous binding', () => {
    const intent = { id: 'pi_1', latest_charge: 'ch_1', status: 'succeeded', amount: 1500, amount_received: 1500, currency: 'eur' };
    const charge = { id: 'ch_1', payment_intent: 'pi_1', paid: true, captured: true, amount: 1500, currency: 'eur' };
    expect(() => assertCheckoutCharge(order, session, intent, charge)).not.toThrow();
    for (const changed of [{ ...intent, amount_received: 2000 }, { ...intent, status: 'processing' }, { ...intent, latest_charge: 'other' }]) {
      expect(() => assertCheckoutCharge(order, session, changed, charge)).toThrow();
    }
    expect(() => assertCheckoutCharge(order, session, intent, { ...charge, captured: false })).toThrow();
    expect(() => assertCheckoutCharge({ ...order, stripeChargeId: 'other' }, session, intent, charge)).toThrow();
  });
});
