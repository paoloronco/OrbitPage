import { shopOrderLabel } from "../../packages/shop/orders.js";
import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, withTransaction } from '../database.js';
import { ShopError, shopOrder, shopCustomer, shopSettings, saveShopOrder, shopSign, shopSafeEqual, bookingUrlForOrder, queueShopEmail, deliveryTokenForOrder, getShopPurchasePresentation } from './shop.js';

const decode = row => row ? JSON.parse(row.data) : null;
const now = () => new Date().toISOString();
const eligible = order => order && !order.customerDataErasedAt && ['paid', 'partially_refunded'].includes(order.status);
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new ShopError(400, 'SHOP_CUSTOMER_ACCESS_INVALID', message); };
const tokenSchema = z.object({ customerId: z.string().regex(/^[a-f0-9]{64}$/), orderIds: z.array(z.string().uuid()).max(100), version: z.string().uuid(),
  issuedAt: z.number().int(), expiresAt: z.number().int(), nonce: z.string().uuid() }).strict();
export function parseShopCustomerToken(raw) {
  if (typeof raw !== 'string' || raw.length > 10_000) fail('Invalid customer access link.');
  const [body, signature, extra] = raw.split('.');
  if (!body || extra || !shopSafeEqual(signature, shopSign('customer-portal', body))) fail('Invalid customer access link.');
  let token;
  try { token = tokenSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))); }
  catch { fail('Invalid customer access link.'); }
  if (token.issuedAt > Date.now() || token.expiresAt <= Date.now() || token.expiresAt - token.issuedAt > 7 * 86400_000) fail('Customer access link expired. Use a recent purchase link.');
  return token;
}
async function customerCapability(raw) {
  const token = parseShopCustomerToken(raw), customer = await shopCustomer(token.customerId);
  if (!customer || customer.portalVersion !== token.version) fail('Customer access is no longer active.');
  return { token, customer };
}
export async function getShopCustomerPortal(raw) {
  const { token, customer } = await customerCapability(raw);
  const [rows, bookings, setting] = await Promise.all([
    dbAll('SELECT data FROM shop_orders WHERE customer_id = ?', [customer.customerId]), dbAll('SELECT data FROM shop_bookings'), shopSettings(),
  ]);
  const orders = rows.map(decode).filter(order => token.orderIds.includes(order.orderId) && eligible(order)).map(order => ({
    orderId: order.orderId, orderNumber: order.orderNumber, productTitle: order.productTitle, productType: order.productType, paidAt: order.paidAt,
    bookingUrl: order.productType === 'service' ? bookingUrlForOrder(order) : '', bookingStatus: order.bookingStatus || null,
    sessionsIncluded: order.sessionsIncluded, sessionsRemaining: order.sessionsRemaining,
    fulfillmentText: order.fulfillmentText || '',
    files: (order.deliveryFiles || []).map((file, index) => ({ filename: file.filename, sizeBytes: file.sizeBytes, url: `${setting.publicBase}/api/shop/download/${encodeURIComponent(deliveryTokenForOrder(order.orderId))}?file=${index}` })),
    deliveryUrl: order.productType === 'digital' ? `${setting.publicBase}/shop/download?token=${encodeURIComponent(deliveryTokenForOrder(order.orderId))}` : '',
    downloadsRemaining: Math.max(0, 10 * Math.max(1, order.deliveryFiles?.length || 1) - (order.downloadCount || 0)), expiresAt: order.deliveryExpiresAt,
    intakeQuestions: order.intakeQuestions || [], intakeAnswers: order.intakeAnswers || [], intakeSubmittedAt: order.intakeSubmittedAt || null,
  })).sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  return { shop: await getShopPurchasePresentation(setting), customer: { email: customer.email, shopName: setting.appearance.title || 'Shop', shopUrl: `${setting.publicBase}/shop`, supportEmail: setting.appearance.sellerEmail || '' }, orders,
    bookings: bookings.map(decode).filter(booking => orders.some(order => order.orderId === booking.orderId))
      .map(({ bookingId, orderId, productTitle, status, startAt, endAt, meetingUrl }) => ({ bookingId, orderId, productTitle, status, startAt, endAt, meetingUrl })) };
}
const intakeSchema = z.object({ orderId: z.string().uuid(), answers: z.array(z.object({ questionId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), answer: z.string().trim().max(2000) }).strict()).max(12) }).strict();
export async function submitShopIntake(rawToken, raw) {
  const input = intakeSchema.parse(raw), { token, customer } = await customerCapability(rawToken);
  if (!token.orderIds.includes(input.orderId)) fail('Order not found.');
  return withTransaction(async () => {
    const currentCustomer = await shopCustomer(customer.customerId), order = await shopOrder(input.orderId);
    if (currentCustomer?.portalVersion !== token.version || order?.customerId !== customer.customerId || !eligible(order) || order.productType !== 'service') fail('Order not found.');
    const questions = order.intakeQuestions || [], answers = new Map();
    for (const answer of input.answers) {
      if (answers.has(answer.questionId) || !questions.some(question => question.id === answer.questionId)) fail('Unknown or duplicate questionnaire answer.');
      answers.set(answer.questionId, answer.answer);
    }
    for (const question of questions) if (question.required && !answers.get(question.id)) fail(`Answer required: ${question.prompt}`);
    const timestamp = now();
    await saveShopOrder({ ...order, intakeAnswers: input.answers, intakeSubmittedAt: timestamp, updatedAt: timestamp });
    const setting = await shopSettings(), recipient = order.sellerEmail || setting.email?.fromEmail;
    if (recipient) await queueShopEmail(`intake:${input.orderId}:${hash(JSON.stringify(input.answers))}`, input.orderId, {
      to: recipient, replyTo: order.buyerEmail, subject: `Questionnaire received: ${order.productTitle}`,
      text: `Customer: ${order.buyerEmail}\nProduct: ${order.productTitle}\n\n${questions.map(question => `${question.prompt}\n${answers.get(question.id) || '—'}`).join('\n\n')}\n\nOrder: ${shopOrderLabel(order)}`,
    });
    return { ok: true, intakeAnswers: input.answers, intakeSubmittedAt: timestamp };
  });
}
const stringValue = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
const eventStatus = trigger => ({ BOOKING_CREATED: 'scheduled', BOOKING_RESCHEDULED: 'rescheduled', BOOKING_CANCELLED: 'cancelled', MEETING_ENDED: 'completed', NO_SHOW: 'no_show' })[trigger] || null;
const dateValue = (...values) => { const value = stringValue(...values); return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; };
const meetingUrl = (...values) => {
  const value = stringValue(...values); if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; } catch { return null; }
};
export async function processShopCalendarWebhook(routeToken, rawBody, signature) {
  const expected = createHmac('sha256', shopSign('calcom-webhook', 'owner')).update(rawBody).digest('hex');
  if (!shopSafeEqual(routeToken, shopSign('calcom-route', 'owner')) || !shopSafeEqual(signature, expected)) throw new ShopError(400, 'CALENDAR_SIGNATURE_INVALID', 'Invalid calendar webhook signature.');
  const event = JSON.parse(rawBody.toString('utf8')), status = eventStatus(stringValue(event.triggerEvent, event.type));
  if (!status) return { ignored: true };
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}, metadata = payload.metadata || {};
  const providerId = stringValue(payload.uid, payload.bookingUid, typeof payload.id === 'number' ? String(payload.id) : payload.id);
  if (!providerId || providerId.length > 200) fail('Calendar booking ID is missing.');
  const bookingId = hash(`calcom\0${providerId}`), predecessorUid = status === 'rescheduled' ? stringValue(payload.rescheduleUid) : '';
  const predecessorId = predecessorUid && predecessorUid !== providerId ? hash(`calcom\0${predecessorUid}`) : null;
  return withTransaction(async () => {
    const existing = decode(await dbGet('SELECT data FROM shop_bookings WHERE id = ?', [bookingId]));
    const predecessor = predecessorId ? decode(await dbGet('SELECT data FROM shop_bookings WHERE id = ?', [predecessorId])) : null;
    const orderId = stringValue(metadata.orbitpageOrderId, payload.orbitpageOrderId) || existing?.orderId || predecessor?.orderId;
    if (!z.string().uuid().safeParse(orderId).success) fail('Calendar booking has no matching order.');
    const order = await shopOrder(orderId);
    if (!eligible(order) || order.productType !== 'service' || !order.customerId || !order.buyerEmail) fail('Calendar booking order is not eligible.');
    for (const previous of [existing, predecessor]) if (previous && (previous.orderId !== orderId || previous.customerId !== order.customerId)) fail('Calendar booking ownership mismatch.');
    if (!existing && predecessor && (predecessor.supersededBy || ['cancelled', 'completed', 'no_show'].includes(predecessor.status))) fail('Calendar reschedule predecessor is no longer active.');
    if (!existing && !predecessor && !shopSafeEqual(stringValue(metadata.orbitpageBookingAccess), shopSign('calcom-order', `${orderId}\0${order.customerId}`))) fail('Calendar booking requires order-specific access.');
    if (existing?.supersededBy || (!existing && status === 'cancelled') || (existing && (
      (['cancelled', 'completed', 'no_show'].includes(existing.status) && existing.status !== status) || (status === 'scheduled' && existing.status !== 'scheduled')
    ))) return { ignored: true };
    const consumed = Boolean(existing?.sessionConsumed || (!existing && predecessor?.sessionConsumed));
    const consumes = status !== 'cancelled' && (consumed || ['scheduled', 'rescheduled', 'completed', 'no_show'].includes(status));
    const included = Math.max(1, Number(order.sessionsIncluded || 1)), remaining = Math.min(included, Math.max(0, Number(order.sessionsRemaining ?? included)));
    if (!consumed && consumes && remaining <= 0) fail('No purchased sessions remain.');
    const nextRemaining = !consumed && consumes ? remaining - 1 : consumed && !consumes ? Math.min(included, remaining + 1) : remaining;
    const timestamp = now(), startAt = dateValue(payload.startTime, payload.start), endAt = dateValue(payload.endTime, payload.end), url = meetingUrl(payload.meetingUrl, payload.videoCallUrl, payload.location);
    if (!existing && predecessor) await dbRun('UPDATE shop_bookings SET data = ? WHERE id = ?', [JSON.stringify({ ...predecessor, status: 'cancelled', sessionConsumed: false, supersededBy: bookingId, updatedAt: timestamp }), predecessorId]);
    const booking = { ...existing, bookingId, orderId, customerId: order.customerId, customerEmail: order.buyerEmail, productTitle: order.productTitle,
      provider: 'calcom', providerBookingId: providerId, status, startAt, endAt, meetingUrl: url, sessionConsumed: consumes,
      reminder24hSentAt: existing?.reminder24hSentAt || null, reminder1hSentAt: existing?.reminder1hSentAt || null,
      createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
    await dbRun('INSERT INTO shop_bookings (id, order_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [bookingId, orderId, JSON.stringify(booking)]);
    await saveShopOrder({ ...order, bookingStatus: status, sessionsRemaining: nextRemaining, scheduledStartAt: startAt, scheduledEndAt: endAt, updatedAt: timestamp });
    const changed = existing?.status !== status || existing?.startAt !== startAt || existing?.meetingUrl !== url;
    if (changed) {
      const setting = await shopSettings(), seller = order.sellerEmail || setting.email?.fromEmail;
      for (const recipient of [order.buyerEmail, seller].filter(Boolean)) await queueShopEmail(`booking:${bookingId}:${hash(`${status}\0${startAt}\0${url}`)}:${hash(recipient)}`, orderId, {
        to: recipient, replyTo: recipient === order.buyerEmail ? seller : order.buyerEmail,
        subject: `Booking ${status.replaceAll('_', ' ')}: ${order.productTitle}`,
        text: `Booking status: ${status}\nProduct: ${order.productTitle}\n${startAt ? `Date: ${startAt}\n` : ''}Order: ${shopOrderLabel(order)}`,
      });
    }
    return { ok: true, bookingId, status };
  });
}
export async function dispatchShopBookingReminders() {
  let queued = 0;
  await withTransaction(async () => {
    const setting = await shopSettings();
    if (!setting.email?.password) return;
    for (const row of await dbAll('SELECT data FROM shop_bookings')) {
      const booking = decode(row), remaining = Date.parse(booking.startAt) - Date.now();
      if (!['scheduled', 'rescheduled'].includes(booking.status) || !(remaining > 0)) continue;
      const reminder = remaining <= 75 * 60_000 && !booking.reminder1hSentAt ? ['reminder1hSentAt', 'in about one hour']
        : remaining <= 25 * 3600_000 && remaining > 75 * 60_000 && !booking.reminder24hSentAt ? ['reminder24hSentAt', 'tomorrow'] : null;
      if (!reminder) continue;
      const order = await shopOrder(booking.orderId); if (!eligible(order)) continue;
      const seller = order.sellerEmail || setting.email.fromEmail;
      for (const recipient of [order.buyerEmail, seller].filter(Boolean)) await queueShopEmail(`reminder:${booking.bookingId}:${booking.startAt}:${reminder[0]}:${hash(recipient)}`, booking.orderId, {
        to: recipient, replyTo: recipient === order.buyerEmail ? seller : order.buyerEmail,
        subject: `Reminder: ${booking.productTitle} ${reminder[1]}`,
        text: `Reminder for ${booking.productTitle}.\nDate: ${booking.startAt}\n${booking.meetingUrl ? `Link: ${booking.meetingUrl}\n` : ''}Order: ${shopOrderLabel(order)}`,
      });
      booking[reminder[0]] = now(); await dbRun('UPDATE shop_bookings SET data = ? WHERE id = ?', [JSON.stringify(booking), booking.bookingId]); queued++;
    }
  });
  return { queued };
}
