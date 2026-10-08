import { renderShopDescription, shopProductSummary } from "./description.js";
import { shopPolicies } from "./policies.js";
const PUBLIC_SHOP_LOCALE = "en";
const productFiles = product => product.files?.length ? product.files : product.file ? [product.file] : [];
export function shopPolicyLinks(appearance, canonicalUrl) {
    return {
        terms: appearance.termsText ? `${canonicalUrl}/legal#terms` : appearance.termsUrl,
        digitalLicense: appearance.digitalLicenseText ? `${canonicalUrl}/legal#digital-license` : appearance.digitalLicenseUrl,
        privacy: appearance.privacyText ? `${canonicalUrl}/legal#privacy` : appearance.privacyUrl,
        refunds: appearance.refundPolicyText ? `${canonicalUrl}/legal#refunds` : appearance.refundPolicyUrl,
        withdrawal: appearance.withdrawalText ? `${canonicalUrl}/legal#withdrawal` : appearance.withdrawalUrl
    };
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
function safeJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}
function markdownText(value) {
    return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().replace(/([\\`*_{}\[\]<>])/g, "\\$1");
}
export function renderShopMarkdown(input) {
    const appearance = input.appearance;
    const products = input.products.map((product) => [
        `## ${markdownText(product.title)}`,
        markdownText(product.description),
        `Price: ${formatEur(product.priceCents, PUBLIC_SHOP_LOCALE)}`,
        `Type: ${product.type}`,
    ].join("\n\n"));
    return [appearance.showTitle && appearance.title ? `# ${markdownText(appearance.title)}` : "", appearance.showDescription ? markdownText(appearance.description) : "", `Canonical: ${input.canonicalUrl}`, ...products].filter(Boolean).join("\n\n") + "\n";
}
function formatEur(cents, locale) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(cents / 100);
}
function themeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function safeThemeColor(value, fallback) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}
function safeFontFamily(value) {
    return typeof value === "string" && value.length <= 120 && /^[a-z0-9\s,"'-]+$/i.test(value)
        ? value
        : 'Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
}
function hexToRgba(hex, opacity) {
    const normalized = hex.replace("#", "");
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${Math.min(1, Math.max(0, opacity)).toFixed(2)})`;
}
export function resolvedShopDesign(appearance, theme) {
    if (!appearance.inheritPageTheme) {
        return {
            pageBackground: appearance.pageBackground,
            pageBackgroundSecondary: appearance.pageBackground,
            textColor: appearance.textColor,
            mutedColor: appearance.mutedColor,
            accentColor: appearance.accentColor,
            buttonTextColor: appearance.buttonTextColor,
            cardBackground: appearance.cardBackground,
            cardTextColor: appearance.cardTextColor,
            borderColor: appearance.borderColor,
            cardRadius: appearance.cardRadius,
            fontFamily: safeFontFamily(null)
        };
    }
    const contentCard = themeObject(theme.contentCard);
    const backgroundGradient = themeObject(theme.backgroundGradient);
    return {
        pageBackground: safeThemeColor(theme.background, appearance.pageBackground),
        pageBackgroundSecondary: safeThemeColor(backgroundGradient.to ?? theme.backgroundSecondary, appearance.pageBackground),
        textColor: safeThemeColor(theme.foreground, appearance.textColor),
        mutedColor: safeThemeColor(theme.muted, appearance.mutedColor),
        accentColor: safeThemeColor(theme.primary ?? theme.accent, appearance.accentColor),
        buttonTextColor: safeThemeColor(contentCard.accentForeground, appearance.buttonTextColor),
        cardBackground: safeThemeColor(contentCard.background ?? theme.card, appearance.cardBackground),
        cardTextColor: safeThemeColor(contentCard.foreground ?? theme.foreground, appearance.cardTextColor),
        borderColor: safeThemeColor(contentCard.border ?? theme.border, appearance.borderColor),
        cardRadius: typeof theme.cardRadius === "number" ? Math.min(32, Math.max(0, Math.round(theme.cardRadius))) : appearance.cardRadius,
        fontFamily: safeFontFamily(theme.fontFamily)
    };
}
function shopCardSurface(effect, color, opacity) {
    if (effect === "transparent")
        return "background:transparent;backdrop-filter:none";
    if (effect === "liquid-glass") {
        return `background:${hexToRgba(color, Math.min(.72, opacity * .62))};backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%)`;
    }
    return `background:${hexToRgba(color, opacity)};backdrop-filter:none`;
}
export function shopPurchasePresentation({ appearance, theme = {}, shopUrl, title = "Shop" }) {
    return {
        name: appearance.title || title,
        url: shopUrl,
        logoUrl: appearance.logoUrl ? new URL(appearance.logoUrl, shopUrl).toString() : "",
        supportEmail: appearance.sellerEmail,
        design: resolvedShopDesign(appearance, theme),
        cardEffect: appearance.cardEffect,
        cardOpacity: appearance.cardOpacity
    };
}
export function renderShopHtml(input) {
    const appearance = input.appearance;
    const title = appearance.showTitle ? appearance.title : "";
    const description = appearance.showDescription ? appearance.description : "";
    const compactHeader = !title && !description;
    const locale = PUBLIC_SHOP_LOCALE;
    const tr = (english, _italian = english) => english;
    const design = resolvedShopDesign(appearance, input.theme || {});
    const policyLinks = shopPolicyLinks(appearance, input.canonicalUrl);
    const policyNav = shopPolicies(appearance, input.canonicalUrl)
        .map(({ url, title }) => `<a href="${escapeHtml(url)}" rel="noreferrer" target="_blank">${escapeHtml(title)}</a>`).join("");
    const sellerNotice = appearance.sellerType === "private"
        ? "I understand that the page owner is the seller and has declared they are not a trader. EU consumer protection rights do not apply to this contract."
        : "I understand that the page owner is the seller. Any seller policies shown on this page apply; my statutory rights are not waived.";
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: appearance.title || input.title,
        description: appearance.description,
        url: input.canonicalUrl,
        itemListElement: input.products.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
                "@type": "Product",
                name: product.title,
                description: product.description,
                url: input.canonicalUrl,
                offers: {
                    "@type": "Offer",
                    priceCurrency: "EUR",
                    price: (product.priceCents / 100).toFixed(2),
                    availability: "https://schema.org/InStock",
                    url: input.canonicalUrl,
                },
            },
        })),
    };
    const cards = input.products.map((product) => {
        const cardStyle = product.cardStyle;
        const sessionsIncluded = Math.max(1, product.sessionsIncluded || 1);
        const sessionsLabel = sessionsIncluded === 1
            ? tr("1 session included", "1 sessione inclusa")
            : tr("{count} sessions included", "{count} sessioni incluse").replaceAll("{count}", String(sessionsIncluded));
        const coverUrl = (input.previewOnly ? input.previewCoverUrls?.[product.productId] : undefined) || (product.coverKey ? `${input.coverUrlPrefix}${product.coverKey}` : null);
        const cover = coverUrl ? `<img class="product-cover" alt="" loading="lazy" src="${escapeHtml(coverUrl)}">` : "";
        return `
    <article class="product ${coverUrl ? "has-cover" : "no-cover"} effect-${cardStyle.surfaceEffect} align-${cardStyle.alignment}" data-product-dialog="product-${escapeHtml(product.productId)}" data-search="${escapeHtml([product.title, product.summary, product.description].filter(Boolean).join(" "))}" style="--product-bg:${cardStyle.backgroundColor || design.cardBackground};--product-ink:${cardStyle.textColor || design.cardTextColor}">
      ${cover}
      ${appearance.showProductType ? `<div class="product-kind">${escapeHtml(product.type === "digital" ? tr("Digital download", "Download digitale") : tr("Service", "Servizio"))}</div>` : ""}
      <h2>${escapeHtml(product.title)}</h2>
      <div class="product-excerpt">${renderShopDescription(shopProductSummary(product))}</div>
      ${product.type === "service" && sessionsIncluded > 1 ? `<div class="package-size">${escapeHtml(sessionsLabel)}</div>` : ""}
      <div class="product-footer"><strong>${escapeHtml(formatEur(product.priceCents, locale))}</strong><button class="open-product" aria-controls="product-${escapeHtml(product.productId)}" aria-haspopup="dialog" data-product-dialog="product-${escapeHtml(product.productId)}" type="button">${escapeHtml(tr("View details", "Vedi dettagli"))}</button></div>
    </article>
    <dialog class="product-dialog" id="product-${escapeHtml(product.productId)}" aria-labelledby="title-${escapeHtml(product.productId)}">
      <button class="close-product" aria-label="${escapeHtml(tr("Close", "Chiudi"))}" type="button">×</button>
      ${cover}
      <div class="product-dialog-body"><h2 id="title-${escapeHtml(product.productId)}">${escapeHtml(product.title)}</h2><div class="product-description">${renderShopDescription(product.description)}</div>${product.type === "digital" ? `<p class="file-list">${productFiles(product).map((file) => escapeHtml(file.filename)).join(" · ")}</p>` : ""}
      ${input.previewOnly ? `<p class="demo-notice">Fictional example — no purchase or payment is made.</p><a class="back" href="${escapeHtml(`${input.apiBaseUrl}/signup`)}">Create your own Shop →</a>` : `<form class="checkout-form" action="${escapeHtml(`${input.apiBaseUrl}/api/shop/checkout`)}" method="post">
        <input name="slug" type="hidden" value="${escapeHtml(input.username)}">
        <input name="productId" type="hidden" value="${escapeHtml(product.productId)}">
        ${product.type === "digital" && policyLinks.digitalLicense ? `<p class="purchase-consent"><a href="${escapeHtml(policyLinks.digitalLicense)}" rel="noreferrer" target="_blank">${escapeHtml(tr("Digital Product & License Terms", "Termini dei prodotti digitali e delle licenze"))}</a></p>` : ""}
        <label class="purchase-consent"><input name="sellerNoticeAcknowledged" required type="checkbox" value="accepted"><span>${escapeHtml(sellerNotice)}</span></label>
        ${product.type === "digital" ? `<label class="purchase-consent digital-consent"><input name="digitalContentConsent" required type="checkbox" value="accepted"><span>${escapeHtml(tr("I expressly consent to immediate supply of the digital content and acknowledge that I lose my withdrawal right once the download begins.", "Acconsento espressamente alla fornitura immediata del contenuto digitale e riconosco di perdere il diritto di recesso quando inizia il download."))}</span></label>` : ""}
        <div class="product-footer">
          <strong>${escapeHtml(formatEur(product.priceCents, locale))}</strong>
          <button type="submit">${escapeHtml(tr("Buy", "Acquista"))}</button>
        </div>
      </form>`}
      </div>
    </dialog>`;
    }).join("");
    const sellerDetails = `<details class="seller"><summary><span>${escapeHtml(tr("Seller information", "Informazioni sul venditore"))}: <strong>${escapeHtml(appearance.sellerName || input.title)}</strong></span><span class="seller-more">${escapeHtml(tr("View more", "Vedi di più"))}</span></summary><div class="seller-content">${appearance.sellerType === "trader" ? `<p>${escapeHtml(tr("Professional seller", "Venditore professionale"))}</p>` : ""}<dl>${appearance.sellerAddress ? `<div><dt>${escapeHtml(tr("Address", "Indirizzo"))}</dt><dd>${escapeHtml(appearance.sellerAddress)}</dd></div>` : ""}${appearance.sellerEmail ? `<div><dt>Email</dt><dd><a href="mailto:${escapeHtml(appearance.sellerEmail)}">${escapeHtml(appearance.sellerEmail)}</a></dd></div>` : ""}${appearance.sellerPhone ? `<div><dt>${escapeHtml(tr("Phone", "Telefono"))}</dt><dd>${escapeHtml(appearance.sellerPhone)}</dd></div>` : ""}${appearance.sellerBusinessId ? `<div><dt>${escapeHtml(tr("Business / tax ID", "Identificativo impresa / fiscale"))}</dt><dd>${escapeHtml(appearance.sellerBusinessId)}</dd></div>` : ""}</dl></div></details>`;
    const legacyPolicyLinks = {
        "#seller-terms": policyLinks.terms,
        "#seller-digital-license": policyLinks.digitalLicense,
        "#seller-privacy": policyLinks.privacy,
        "#seller-refunds": policyLinks.refunds,
        "#seller-withdrawal": policyLinks.withdrawal
    };
    const search = input.products.length ? `<label class="shop-search"><svg aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input aria-label="${escapeHtml(tr("Search products", "Cerca prodotti"))}" data-shop-search placeholder="${escapeHtml(tr("Search products", "Cerca prodotti"))}" type="search"></label>` : "";
    const newsletterEndpoint = input.newsletterEndpoint;
    return `<!doctype html><html lang="${escapeHtml("en-US")}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(appearance.title || input.title)} · ${escapeHtml(input.title)}</title><meta name="description" content="${escapeHtml(appearance.description)}"><link rel="canonical" href="${escapeHtml(input.canonicalUrl)}">${input.machineReadableEnabled ? `<link rel="alternate" type="text/markdown" href="${escapeHtml(input.canonicalUrl)}">` : ""}<script type="application/ld+json">${safeJson(structuredData)}</script><style>
  :root{color-scheme:light dark;--ink:${design.textColor};--muted:${design.mutedColor};--line:${design.borderColor};--brand:${design.accentColor};--button-ink:${design.buttonTextColor};--surface:${design.cardBackground};--canvas:${design.pageBackground};--radius:${design.cardRadius}px;--shadow:0 ${Math.round(4 + appearance.shadowIntensity * .12)}px ${Math.round(10 + appearance.shadowIntensity * .34)}px rgba(4,12,28,${(appearance.shadowIntensity / 250).toFixed(2)})}*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;background:linear-gradient(145deg,var(--canvas),${design.pageBackgroundSecondary});background-attachment:fixed;color:var(--ink);font:16px/1.55 ${design.fontFamily}}.shell{width:min(${appearance.layout === "list" ? "760px" : "1040px"},calc(100% - 32px));margin:0 auto;padding:56px 0 72px}.back{display:inline-flex;color:var(--muted);text-decoration:none;margin-bottom:34px}.back:hover{color:var(--brand)}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;border-bottom:1px solid var(--line);padding-bottom:28px;text-align:${appearance.alignment}}.eyebrow{text-transform:uppercase;font-size:12px;font-weight:800;color:var(--brand)}h1{font-size:clamp(34px,6vw,64px);line-height:1.02;margin:8px 0 0;letter-spacing:0}.hero p{max-width:480px;color:var(--muted);margin:0;white-space:pre-line}.grid{display:grid;grid-template-columns:${appearance.layout === "list" ? "1fr" : "repeat(2,minmax(0,1fr))"};gap:18px;padding-top:28px}.product{${shopCardSurface(appearance.cardEffect, design.cardBackground, appearance.cardOpacity)};border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);color:var(--product-ink);padding:24px;display:flex;flex-direction:column;min-height:${appearance.layout === "list" ? "220px" : "270px"};text-align:${appearance.alignment};overflow:hidden}.product.effect-solid{background:var(--product-bg);backdrop-filter:none}.product.effect-transparent{background:transparent;backdrop-filter:none}.product.effect-liquid-glass{background:color-mix(in srgb,var(--product-bg) ${Math.round(Math.min(.72, appearance.cardOpacity * .62) * 100)}%,transparent);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%)}.product.align-left{text-align:left}.product.align-center{text-align:center}.product-kind{text-transform:uppercase;color:var(--brand);font-size:11px;font-weight:800}.product h2{font-size:24px;line-height:1.2;margin:12px 0 8px}.product p{color:color-mix(in srgb,var(--product-ink) 68%,transparent);margin:0 0 18px;white-space:pre-line}.package-size{align-self:${appearance.alignment === "center" ? "center" : "flex-start"};margin-bottom:22px;padding:6px 9px;border:1px solid var(--line);border-radius:999px;color:var(--brand);font-size:12px;font-weight:800}.checkout-form{display:flex;flex-direction:column;gap:12px;margin-top:auto;text-align:left}.purchase-consent{display:flex;gap:8px;align-items:flex-start;color:color-mix(in srgb,var(--product-ink) 76%,transparent);font-size:12px;line-height:1.45}.purchase-consent input{flex:0 0 auto;margin-top:2px}.purchase-consent a{color:inherit}.product-footer{display:flex;align-items:center;justify-content:space-between;gap:16px}.product-footer strong{font-size:22px}.product button,.checkout-form button[type=submit]{border:0;border-radius:max(6px,calc(var(--radius) * .55));background:var(--brand);color:var(--button-ink);min-height:46px;min-width:128px;padding:10px 20px;font:inherit;font-size:15px;font-weight:800;line-height:1.45;cursor:pointer}.product button:hover,.checkout-form button[type=submit]:hover{filter:brightness(.92)}.empty{grid-column:1/-1;padding:44px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:var(--radius)}.seller,.policies{margin-top:30px;padding:24px;border:1px solid var(--line);border-radius:var(--radius)}.seller{display:grid;grid-template-columns:1fr 1fr;gap:22px}.seller h2{margin:6px 0;font-size:22px}.seller p{color:var(--muted);margin:0}.seller dl{margin:0}.seller dl div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:5px 0}.seller dt{color:var(--muted)}.seller dd{margin:0}.seller a{color:inherit}.seller nav{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:14px;padding-top:16px;border-top:1px solid var(--line)}.policies article{scroll-margin-top:24px;padding-top:22px}.policies article+article{border-top:1px solid var(--line);margin-top:22px}.policies h2{font-size:20px;margin:0 0 8px}.policies p{color:var(--muted);margin:0;white-space:pre-wrap}footer{padding:44px 0 16px;color:var(--muted);font-size:13px;text-align:center}footer a{color:inherit}.shop-policy-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;margin-bottom:20px}@media(max-width:700px){.shell{padding-top:30px}.hero{display:block}.hero p{margin-top:18px}.grid{grid-template-columns:1fr}.product{min-height:230px}.seller{grid-template-columns:1fr}.seller nav{grid-column:auto}.seller dl div{grid-template-columns:1fr;gap:0}}
  .grid{align-items:stretch}.product{min-width:0;min-height:0;padding:0 0 20px}.product-cover{display:block;width:100%;aspect-ratio:4/3;object-fit:scale-down;background:color-mix(in srgb,var(--brand) 16%,var(--surface));border-radius:var(--radius) var(--radius) 0 0}.product-cover.placeholder{display:grid;place-items:center;color:var(--brand);font-size:64px;font-weight:800}.product>.product-kind,.product>h2,.product>.product-excerpt,.product>.package-size,.product>.product-footer{margin-left:16px;margin-right:16px}.product>h2{overflow-wrap:anywhere}.product-excerpt{height:4.7em;overflow:hidden;overflow-wrap:anywhere}.product>.product-footer{margin-top:auto}.product-dialog{--ink:${design.cardTextColor};--product-ink:${design.cardTextColor};--muted:color-mix(in srgb,${design.cardTextColor} 68%,transparent);width:min(620px,calc(100% - 28px));max-height:90vh;padding:0;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--ink);box-shadow:0 24px 80px #0005;overflow:auto}.product-dialog::backdrop{background:#081427aa}.product-dialog .product-cover{aspect-ratio:16/9}.product-dialog-body{padding:24px}.product-dialog-body h2{margin:0 0 14px}.product-description{overflow-wrap:anywhere}.product-description p{margin:0 0 10px}.product-description h3{margin:18px 0 8px}.product-description .list-item{padding-left:12px}.product-dialog .close-product{position:absolute;right:12px;top:12px;border:0;border-radius:50%;width:38px;height:38px;background:var(--surface);color:var(--ink);font-size:26px;cursor:pointer}.product-dialog .checkout-form{margin-top:24px}.file-list{color:var(--muted);font-size:13}
  .shell{max-width:960px;container:shop-shell / inline-size}.eyebrow{display:inline-flex;align-items:center;gap:8px}.eyebrow svg{height:17px;width:17px}.product h2{font-size:18px}.product-footer strong{font-size:18px}.grid .product[hidden]{display:none}.shop-search{align-items:center;border:1px solid var(--line);border-radius:max(8px,var(--radius));display:flex;gap:10px;padding:10px 13px;width:100%}.shop-search:focus-within{outline:2px solid var(--brand);outline-offset:2px}.shop-search svg{color:var(--muted);flex:none;height:18px;width:18px}.shop-search input{background:transparent;border:0;color:var(--ink);font:inherit;min-width:0;outline:0;width:100%}.search-empty{color:var(--muted);padding:24px;text-align:center}
  .newsletter-signup{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);margin-top:30px;padding:24px}.newsletter-signup h2{font-size:22px;margin:0 0 6px}.newsletter-signup>p{color:var(--muted);margin:0 0 18px}.newsletter-form{display:grid;gap:12px}.newsletter-fields{display:flex;gap:10px}.newsletter-fields input{background:transparent;border:1px solid var(--line);border-radius:max(6px,calc(var(--radius) * .55));color:var(--ink);font:inherit;min-width:0;padding:11px 13px;width:100%}.newsletter-fields input:focus{outline:2px solid var(--brand);outline-offset:2px}.newsletter-fields button{border:0;border-radius:max(6px,calc(var(--radius) * .55));background:var(--brand);color:var(--button-ink);cursor:pointer;font:inherit;font-weight:800;padding:11px 18px}.newsletter-fields button:disabled{cursor:wait;opacity:.65}.newsletter-consent{align-items:flex-start;color:var(--muted);display:flex;font-size:12px;gap:8px;line-height:1.45}.newsletter-consent input{flex:none;margin-top:2px}.newsletter-message{font-size:13px;margin:12px 0 0}.newsletter-message.error{color:#b42318}@media(max-width:560px){.newsletter-fields{flex-direction:column}}
  .grid .product{cursor:pointer}.product .open-product:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
  .shop-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);margin-bottom:22px;padding-bottom:14px}.shop-topbar .back{margin-bottom:0}.shop-topbar .eyebrow{white-space:nowrap}.hero{display:block;text-align:left}.hero-heading.with-search{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,320px);align-items:center;gap:24px}.hero h1{font-size:clamp(28px,3.6vw,40px);line-height:1.2;margin:0;overflow-wrap:anywhere}.hero .hero-description{max-width:none;margin:24px 0 0;overflow-wrap:anywhere}.grid{grid-template-columns:${appearance.layout === "list" ? "minmax(0,1fr)" : "repeat(auto-fill,minmax(min(100%,17rem),1fr))"}}@container shop-shell (max-width:660px){.hero-heading.with-search{grid-template-columns:minmax(0,1fr);gap:18px}}@media(max-width:700px){.shop-topbar{margin-bottom:20px}}
  footer .seller{display:block;margin:0 0 20px;padding:0;background:var(--surface);text-align:left}footer .seller summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;cursor:pointer;list-style:none}footer .seller summary::-webkit-details-marker{display:none}footer .seller summary:focus-visible{outline:2px solid var(--brand);outline-offset:2px}footer .seller summary strong{color:var(--ink)}footer .seller-more{color:var(--brand);border:1px solid var(--brand);border-radius:999px;padding:6px 10px;font-weight:700;white-space:nowrap}footer .seller-more::after{content:"⌄";margin-left:8px}footer .seller[open] .seller-more::after{content:"⌃"}footer .seller-content{padding:12px 20px 20px;border-top:1px solid var(--line)}footer .seller a{color:var(--brand)}
  .shell{display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;padding-bottom:0}.shell>*{flex-shrink:0}.shell>footer{margin-top:auto}.shop-topbar .back{flex-direction:column;gap:2px;max-width:55%}.shop-topbar .back small{font-size:12px}.shop-topbar .eyebrow{justify-content:flex-end;max-width:40%}.eyebrow img{display:block;max-height:64px;max-width:360px;object-fit:contain;width:100%}.grid{grid-template-columns:${appearance.layout === "list" ? "minmax(0,min(100%,480px))" : "repeat(auto-fill,minmax(min(100%,300px),1fr))"};grid-auto-flow:row dense;grid-auto-rows:230px;gap:12px;justify-content:${appearance.alignment === "center" ? "center" : "start"}}.grid:has(>.empty){grid-template-columns:minmax(0,1fr)}.grid>.product{min-height:0;height:100%;padding-bottom:16px}.grid>.product.has-cover{grid-row:span 2}.grid>.product.no-cover{padding-top:16px;order:${appearance.layout === "grid" ? "1" : "0"}}@container shop-shell (max-width:660px){.grid>.product.no-cover{order:0}}.grid>.product>.product-cover{aspect-ratio:auto;flex:none;height:230px;margin-bottom:12px}.grid>.product>h2{display:-webkit-box;font-size:18px;line-height:1.3;margin:8px 16px 0;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}.grid>.product>.product-kind{margin-bottom:8px}.grid>.product>.product-kind,.grid>.product>h2,.grid>.product>.product-footer{flex-shrink:0}.grid>.product>.product-excerpt{flex:1;min-height:0;display:-webkit-box;font-size:13px;line-height:1.45;height:auto;margin-top:6px;margin-bottom:10px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3}.grid>.product>.product-excerpt:has(+.package-size){-webkit-line-clamp:2}.product-excerpt p,.product-excerpt h2{font-size:inherit;line-height:inherit;margin:0}.product-description h2{font-size:20px;margin:18px 0 8px}.product-dialog .product-cover{height:auto}.grid>.product>.product-footer{gap:10px}.package-size{font-size:11px;margin-bottom:10px;padding:4px 8px}.empty{grid-column:1/-1}
  .shop-topbar.centered-logo{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}.shop-topbar.centered-logo .back{max-width:100%;overflow-wrap:anywhere}.shop-topbar.centered-logo .eyebrow{justify-content:center;justify-self:center;max-width:100%;min-width:0;white-space:normal}.shop-topbar.centered-logo .shop-search{min-width:0}@container shop-shell (max-width:420px){.shop-topbar.centered-logo .back{font-size:12px}.shop-topbar.centered-logo .shop-search{font-size:12px;gap:6px;padding:8px}}
  .hero h1{color:${appearance.titleColor || design.textColor};font-family:${appearance.titleFontFamily ? safeFontFamily(appearance.titleFontFamily) : design.fontFamily};font-size:${appearance.titleFontSize ? `${appearance.titleFontSize}px` : "clamp(28px,3.6vw,40px)"};font-weight:${appearance.titleFontWeight}}.hero .hero-description{color:${appearance.descriptionColor || design.mutedColor};font-family:${appearance.descriptionFontFamily ? safeFontFamily(appearance.descriptionFontFamily) : design.fontFamily};font-size:${appearance.descriptionFontSize ?? 16}px;font-weight:${appearance.descriptionFontWeight};white-space:pre-wrap}
  </style></head><body><main class="shell">
    <div class="shop-topbar${compactHeader ? " centered-logo" : ""}"><a class="back" href="${escapeHtml(input.canonicalUrl.replace(/\/shop\/?$/, ""))}">← ${escapeHtml(appearance.backLinkLabel)}</a><span class="eyebrow">${appearance.logoUrl ? `<img alt="Shop logo" src="${escapeHtml(appearance.logoUrl)}">` : `<svg aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M2 3h2l2.5 12h12l2.5-9H5"/></svg>${escapeHtml(tr("Shop", "Shop"))}`}</span>${compactHeader ? search : ""}</div>
    ${!compactHeader ? `<section class="hero"><div class="hero-heading${title && input.products.length ? " with-search" : ""}">${title ? `<h1>${escapeHtml(title)}</h1>` : ""}${search}</div>${description ? `<p class="hero-description">${escapeHtml(description)}</p>` : ""}</section>` : ""}
    <section class="grid">${cards || `<div class="empty">${escapeHtml(tr("No products available.", "Nessun prodotto disponibile."))}</div>`}</section>
    ${input.products.length ? `<p aria-live="polite" class="search-empty" hidden>${escapeHtml(tr("No products match your search.", "Nessun prodotto corrisponde alla ricerca."))}</p>` : ""}
    ${appearance.newsletterEnabled ? `<section class="newsletter-signup"><h2>${escapeHtml(tr("Join the newsletter", "Iscriviti alla newsletter"))}</h2><p>${escapeHtml(tr("Get useful updates by email.", "Ricevi aggiornamenti utili via email."))}</p><form class="newsletter-form" data-newsletter-signup><div class="newsletter-fields"><input aria-label="Email" autocomplete="email" maxlength="254" name="email" placeholder="Email" required type="email"><button type="submit">${escapeHtml(tr("Subscribe", "Iscriviti"))}</button></div><label class="newsletter-consent"><input name="consent" required type="checkbox"><span>${escapeHtml(tr("I want to receive email updates. I can unsubscribe at any time.", "Voglio ricevere aggiornamenti email. Posso annullare l'iscrizione in qualsiasi momento."))}</span></label></form><p aria-live="polite" class="newsletter-message" data-newsletter-message></p></section>` : ""}
    <footer>${sellerDetails}<nav class="shop-policy-nav" aria-label="Shop policies">${policyNav}</nav>${escapeHtml(tr("Secure payments with Stripe", "Pagamenti sicuri con Stripe"))} · ${escapeHtml(tr("The page owner is the seller; OrbitPage provides the shop software.", "Il titolare della pagina è il venditore; OrbitPage fornisce il software dello Shop."))} · <a href="https://orbitpage.com">Powered by OrbitPage</a></footer>
  </main><script type="module">
    const legacyPolicy=${safeJson(legacyPolicyLinks)}[location.hash];if(legacyPolicy)location.replace(legacyPolicy);
    let outsideProductDialog=null;const isProductBackdrop=(event)=>{if(!event.target.matches("dialog.product-dialog"))return false;const b=event.target.getBoundingClientRect();return event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom};
    document.addEventListener("pointerdown",event=>{outsideProductDialog=event.button===0&&isProductBackdrop(event)?event.target:null});
    document.addEventListener("click",function(e){const open=e.target.closest("[data-product-dialog]");if(open){document.getElementById(open.dataset.productDialog)?.showModal();return}const close=e.target.closest(".close-product");if(close)close.closest("dialog")?.close();if(outsideProductDialog===e.target&&isProductBackdrop(e))e.target.close()});
    const search=document.querySelector("[data-shop-search]");
    const products=[...document.querySelectorAll(".grid>.product")];
    const noResults=document.querySelector(".search-empty");
    search?.addEventListener("input",()=>{const query=search.value.trim().toLocaleLowerCase();let matches=0;for(const product of products){const found=product.dataset.search.toLocaleLowerCase().includes(query);product.hidden=!found;if(found)matches++}if(noResults)noResults.hidden=!query||matches>0});
    const newsletterForm=document.querySelector("[data-newsletter-signup]");
    const newsletterMessage=document.querySelector("[data-newsletter-message]");
    newsletterForm?.addEventListener("submit",async(event)=>{event.preventDefault();const button=newsletterForm.querySelector("button");button.disabled=true;newsletterMessage.textContent="";newsletterMessage.classList.remove("error");try{const response=await fetch(${safeJson(newsletterEndpoint)},{method:"POST",headers:{"content-type":${safeJson(input.newsletterContentType || "text/plain;charset=UTF-8")}},body:JSON.stringify({${input.newsletterUsername ? `username:${safeJson(input.newsletterUsername)},` : ""}email:new FormData(newsletterForm).get("email"),consent:true})});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error||"Subscription failed.");newsletterForm.hidden=true;newsletterMessage.textContent="Check your inbox to confirm your subscription."}catch(error){newsletterMessage.classList.add("error");newsletterMessage.textContent=error instanceof Error?error.message:"Subscription failed."}finally{button.disabled=false}});
  </script></body></html>`;
}
export function renderShopPolicyHtml(input) {
    const design = resolvedShopDesign(input.appearance, input.theme || {});
    const policies = shopPolicies(input.appearance, input.shopUrl).filter((policy) => policy.text);
    if (!policies.length)
        return null;
    const navigation = shopPolicies(input.appearance, input.shopUrl).map(({ title, url }) => `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`).join("");
    const sections = policies.map(({ slug, title, text }) => `<section id="${slug}"><h2>${escapeHtml(title)}</h2><div class="policy-text">${escapeHtml(text)}</div></section>`).join("");
    return `<!doctype html><html lang="${escapeHtml("en-US")}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Legal · ${escapeHtml(input.appearance.title || "Shop")}</title><link rel="canonical" href="${escapeHtml(input.shopUrl)}/legal"><style>
    :root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;background:${design.pageBackground};color:${design.textColor};font:16px/1.6 ${design.fontFamily}}main{width:min(760px,calc(100% - 32px));margin:0 auto;padding:48px 0 80px}a{color:${design.accentColor}}.back{display:inline-block;margin-bottom:28px;text-decoration:none}article{background:${design.cardBackground};color:${design.cardTextColor};border:1px solid ${design.borderColor};border-radius:${design.cardRadius}px;padding:clamp(24px,5vw,48px)}h1{font-size:clamp(28px,5vw,44px);line-height:1.15;margin:0 0 24px;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-bottom:28px}section{scroll-margin-top:24px}section+section{margin-top:32px;border-top:1px solid ${design.borderColor};padding-top:24px}h2{font-size:24px;line-height:1.25;margin:0 0 18px}.policy-text{white-space:pre-wrap;overflow-wrap:anywhere}.seller{color:${design.mutedColor};margin-top:28px;font-size:14px}
  </style></head><body><main><a class="back" href="${escapeHtml(input.shopUrl)}">← Back to Shop</a><article><h1>Legal</h1><nav aria-label="Shop policies">${navigation}</nav>${sections}${input.appearance.sellerName ? `<p class="seller">${escapeHtml(input.appearance.sellerName)}</p>` : ""}</article></main></body></html>`;
}
export function buildShopHomeLinks(input) {
    const existingIndex = input.links.findIndex((link) => link.systemKey === "shop" ||
        link.orbitPageSystemLink === "orbitpage-shop" ||
        link.id === "orbitpage-shop");
    if (!input.enabled || !input.appearance.homeLinkEnabled) {
        if (existingIndex < 0)
            return { links: input.links, changed: false };
        return { links: input.links.filter((_, index) => index !== existingIndex), changed: true };
    }
    const existing = existingIndex >= 0 ? input.links[existingIndex] : null;
    const previousAppearance = input.previousAppearance || input.appearance;
    const nextLink = {
        ...(existing || {}),
        id: existing?.id || "orbitpage-shop",
        type: "link",
        title: typeof existing?.title === "string" && existing.title !== previousAppearance.homeLinkTitle ? existing.title : input.appearance.homeLinkTitle,
        description: typeof existing?.description === "string" && existing.description !== previousAppearance.homeLinkDescription ? existing.description : input.appearance.homeLinkDescription,
        url: input.shopUrl,
        hideUrl: true,
        isActive: existing?.isActive ?? true,
        size: typeof existing?.size === "string" ? existing.size : "large",
        icon: existing?.icon ?? "",
        iconType: existing?.iconType ?? "emoji",
        surfaceEffect: existing?.surfaceEffect || "inherit",
        systemKey: "shop"
    };
    const links = [...input.links];
    if (existingIndex >= 0)
        links[existingIndex] = nextLink;
    else
        links.unshift(nextLink);
    if (existing && JSON.stringify(existing) === JSON.stringify(nextLink))
        return { links: input.links, changed: false };
    return { links, changed: true };
}
