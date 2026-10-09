import { shopOrderLabel } from "./orders.js";
const escapeEmailHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("\'", "&#39;");
function money(cents, currency) {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
function linkifyText(value) {
    const parts = value.split(/(https?:\/\/[^\s<]+)/gi);
    return parts.map((part) => {
        if (!/^https?:\/\//i.test(part))
            return escapeEmailHtml(part);
        try {
            const url = new URL(part);
            if (!["http:", "https:"].includes(url.protocol))
                return escapeEmailHtml(part);
            const safe = escapeEmailHtml(url.toString());
            return `<a href="${safe}" style="color:#2456d8">${safe}</a>`;
        }
        catch {
            return escapeEmailHtml(part);
        }
    }).join("");
}
export function buildShopBuyerEmail(input) {
    const { order } = input;
    const action = order.productType === "digital"
        ? `Download: ${input.deliveryUrl}`
        : order.fulfillmentText || "The seller will contact you using the email supplied at checkout.";
    const bookingText = order.productType === "service" && order.bookingUrl
        ? `\n\nBook your appointment: ${order.bookingUrl}`
        : "";
    const portalText = input.customerPortalUrl ? `\n\nView your purchases (no account or password needed): ${input.customerPortalUrl}` : "";
    const legalText = [
        order.sellerName ? `Seller: ${order.sellerName}` : "",
        order.sellerType && order.sellerType !== "unset" ? `Seller status: ${order.sellerType === "trader" ? "professional / trader" : "private seller"}` : "",
        order.sellerAddress ? `Seller address: ${order.sellerAddress}` : "",
        order.sellerEmail ? `Seller email: ${order.sellerEmail}` : "",
        order.sellerPhone ? `Seller phone: ${order.sellerPhone}` : "",
        order.sellerBusinessId ? `Business / tax ID: ${order.sellerBusinessId}` : "",
        order.sellerTermsUrl ? `Seller terms: ${order.sellerTermsUrl}` : "",
        order.productType === "digital" && order.sellerDigitalLicenseUrl ? `Digital Product & License Terms: ${order.sellerDigitalLicenseUrl}` : "",
        order.sellerRefundPolicyUrl ? `Refund policy: ${order.sellerRefundPolicyUrl}` : "",
        order.sellerWithdrawalUrl ? `Withdrawal contact: ${order.sellerWithdrawalUrl}` : "",
        order.sellerTermsAcceptedAt ? `Seller terms accepted: ${order.sellerTermsAcceptedAt}` : "",
        order.sellerNoticeAcknowledgedAt ? `Seller notice acknowledged: ${order.sellerNoticeAcknowledgedAt}` : "",
        order.productType === "digital" && order.digitalContentConsentAt
            ? `Digital-content consent: on ${order.digitalContentConsentAt}, you expressly consented to immediate supply and acknowledged losing the withdrawal right once download begins.`
            : ""
    ].filter(Boolean).join("\n");
    const legalHtml = `<div style="margin-top:22px;padding:16px;background:#f6f8fc;border-radius:6px;color:#4b5870;font-size:13px;line-height:1.65"><strong style="color:#0c1528">Seller and purchase record</strong>${order.sellerName ? `<br>Seller: ${escapeEmailHtml(order.sellerName)}` : ""}${order.sellerType && order.sellerType !== "unset" ? `<br>Seller status: ${order.sellerType === "trader" ? "professional / trader" : "private seller"}` : ""}${order.sellerAddress ? `<br>Address: ${escapeEmailHtml(order.sellerAddress)}` : ""}${order.sellerEmail ? `<br>Email: ${escapeEmailHtml(order.sellerEmail)}` : ""}${order.sellerPhone ? `<br>Phone: ${escapeEmailHtml(order.sellerPhone)}` : ""}${order.sellerBusinessId ? `<br>Business / tax ID: ${escapeEmailHtml(order.sellerBusinessId)}` : ""}${order.sellerTermsAcceptedAt ? `<br>Seller terms accepted: ${escapeEmailHtml(order.sellerTermsAcceptedAt)}` : ""}${order.sellerNoticeAcknowledgedAt ? `<br>Seller notice acknowledged: ${escapeEmailHtml(order.sellerNoticeAcknowledgedAt)}` : ""}${order.productType === "digital" && order.digitalContentConsentAt ? `<br>On ${escapeEmailHtml(order.digitalContentConsentAt)}, you expressly consented to immediate digital supply and acknowledged losing the withdrawal right once download begins.` : ""}${order.sellerTermsUrl ? `<br><a href="${escapeEmailHtml(order.sellerTermsUrl)}">Seller terms</a>` : ""}${order.sellerRefundPolicyUrl ? ` · <a href="${escapeEmailHtml(order.sellerRefundPolicyUrl)}">Refund policy</a>` : ""}${order.sellerWithdrawalUrl ? ` · <a href="${escapeEmailHtml(order.sellerWithdrawalUrl)}">Withdrawal contact</a>` : ""}${order.sellerPrivacyUrl ? ` · <a href="${escapeEmailHtml(order.sellerPrivacyUrl)}">Privacy</a>` : ""}</div>`;
    const digitalLicenseHtml = order.productType === "digital" && order.sellerDigitalLicenseUrl
        ? `<p><a href="${escapeEmailHtml(order.sellerDigitalLicenseUrl)}">Digital Product &amp; License Terms</a></p>`
        : "";
    const actionHtml = order.productType === "digital"
        ? `<p><a href="${escapeEmailHtml(input.deliveryUrl)}" style="display:inline-block;background:#3568f4;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Download your file</a></p><p style="color:#5f6d83">The private link expires after 30 days and supports up to 10 downloads.</p>`
        : `<p style="white-space:pre-wrap">${linkifyText(action)}</p>${order.bookingUrl ? `<p><a href="${escapeEmailHtml(order.bookingUrl)}" style="display:inline-block;background:#3568f4;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Book your appointment</a></p>` : ""}`;
    return {
        to: order.buyerEmail,
        ...(input.sellerEmail ? { replyTo: input.sellerEmail } : {}),
        subject: `Your order: ${order.productTitle}`,
        text: `Payment confirmed for ${order.productTitle} (${money(order.amountTotal, order.currency)}).\n\n${action}${bookingText}${portalText}\n\nOrder: ${shopOrderLabel(order)}\n\n${legalText}\n`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#0c1528"><h1 style="font-size:26px">Payment confirmed</h1><p>Your order for <strong>${escapeEmailHtml(order.productTitle)}</strong> is ready.</p><p style="color:#5f6d83">${escapeEmailHtml(money(order.amountTotal, order.currency))}</p>${actionHtml}${input.customerPortalUrl ? `<p><a href="${escapeEmailHtml(input.customerPortalUrl)}" style="display:inline-block;border:1px solid #b9c5d9;color:#17346d;text-decoration:none;padding:11px 17px;border-radius:6px;font-weight:700">View your purchases</a></p><p style="color:#5f6d83;font-size:13px">Keep this personal link to return to your files and appointments. No account or password needed.</p>` : ""}<p style="color:#5f6d83;font-size:13px">Order ${escapeEmailHtml(shopOrderLabel(order))}</p>${legalHtml}${digitalLicenseHtml}</div>`
    };
}
export function buildShopSellerEmail(input) {
    const { order } = input;
    const label = order.productType === "service" ? "service" : "digital product";
    return {
        to: input.sellerEmail,
        replyTo: order.buyerEmail,
        subject: `New Shop sale: ${order.productTitle}`,
        text: [
            `You received a new ${label} order on ${input.shopName}.`,
            "",
            `Product: ${order.productTitle}`,
            `Customer: ${order.buyerEmail}`,
            `Total: ${money(order.amountTotal, order.currency)}`,
            `Order: ${shopOrderLabel(order)}`,
            "",
            order.productType === "service"
                ? order.bookingUrl
                    ? "The customer received the calendar link. Reply to this email if you need to contact them directly."
                    : "Reply to this email to contact the customer and arrange the service."
                : "The customer received the private delivery instructions automatically.",
            "",
            `Open Shop orders: ${input.dashboardUrl}`
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#0c1528"><p style="margin:0 0 8px;color:#3568f4;font-size:12px;font-weight:700;text-transform:uppercase">${escapeEmailHtml(input.shopName)} Shop</p><h1 style="font-size:26px;margin:0 0 20px">New sale</h1><p>You received a new ${label} order.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.6;margin:20px 0"><tr><td style="padding:4px 12px 4px 0;color:#66728a">Product</td><td>${escapeEmailHtml(order.productTitle)}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#66728a">Customer</td><td><a href="mailto:${escapeEmailHtml(order.buyerEmail)}">${escapeEmailHtml(order.buyerEmail)}</a></td></tr><tr><td style="padding:4px 12px 4px 0;color:#66728a">Total</td><td>${escapeEmailHtml(money(order.amountTotal, order.currency))}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#66728a">Order</td><td>${escapeEmailHtml(shopOrderLabel(order))}</td></tr></table><p>${order.productType === "service" ? order.bookingUrl ? "The customer received the calendar link. Reply to this email if you need to contact them directly." : "Reply to this email to contact the customer and arrange the service." : "The customer received the private delivery instructions automatically."}</p><p><a href="${escapeEmailHtml(input.dashboardUrl)}" style="display:inline-block;background:#3568f4;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open Shop orders</a></p></div>`
    };
}
