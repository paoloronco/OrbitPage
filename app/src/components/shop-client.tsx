"use client";

import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Copy,
  CreditCard,
  Download,
  Euro,
  FileArchive,
  Link2,
  MailPlus,
  Mail,
  Monitor,
  PackagePlus,
  Palette,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldCheck,
  Settings,
  Smartphone,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UploadCloud,
  X,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { renderShopDescription, shopProductSummary, SHOP_SUMMARY_LIMIT, SHOP_DESCRIPTION_LIMIT } from "../../packages/shop/description.js";
import { SHOP_POLICIES, shopPolicies } from "../../packages/shop/policies.js";
import type { ShopAppearance, ShopBuyerDetails, ShopEmailSettings } from "../../packages/shop/schema.js";
import { ShopDescriptionField, ShopDialog, ShopHelp, ShopLogoDialog } from "./shop-editor-controls";
type Locale = string;
import { OrbitLoader as LoadingIndicator } from "./ui/orbit-loader";
import ColorPicker from "./ui/color-picker";
import RangeSlider from "./ui/range-slider";
import ToggleSwitch from "./ui/toggle-switch";
import { Save } from "./ui/material-icons";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";

type ShopProduct = {
  productId: string;
  type: "digital" | "service";
  title: string;
  description: string;
  summary?: string;
  fulfillmentText: string;
  bookingUrl: string;
  sessionsIncluded: number;
  intakeQuestions: Array<{ id: string; prompt: string; required: boolean }>;
  priceCents: number;
  currency: "eur";
  active: boolean;
  cardStyle: ProductCardStyle;
  file: { id: string; filename: string; contentType: string; sizeBytes: number } | null;
  files: Array<{ id: string; filename: string; contentType: string; sizeBytes: number }>;
  coverUrl: string | null;
};

type ProductCardStyle = {
  backgroundColor: string | null;
  textColor: string | null;
  surfaceEffect: "inherit" | "solid" | "transparent" | "liquid-glass";
  alignment: "inherit" | "left" | "center";
};

type ShopThemePreview = {
  pageBackground: string;
  pageBackgroundSecondary: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  buttonTextColor: string;
  cardBackground: string;
  cardTextColor: string;
  borderColor: string;
  cardRadius: number;
  fontFamily: string;
};

type ShopOrder = {
  orderId: string;
  productTitle: string;
  amountTotal: number;
  applicationFeeAmount: number;
  amountRefunded?: number;
  applicationFeeRefunded?: number;
  currency: "eur";
  status: string;
  buyerEmail: string | null;
  buyerName?: string | null;
  buyerDetails?: ShopBuyerDetails | null;
  downloadCount: number;
  createdAt: string;
  paidAt: string | null;
  productType: "digital" | "service";
  bookingStatus: string | null;
  scheduledStartAt: string | null;
  sessionsIncluded: number;
  sessionsRemaining: number;
  intakeQuestions: Array<{ id: string; prompt: string; required: boolean }>;
  intakeAnswers: Array<{ questionId: string; answer: string }>;
  intakeSubmittedAt: string | null;
};

type ShopDashboard = {
  mode: "stripe" | "unavailable";
  entitled: boolean;
  planId: string;
  shop: null | {
    enabled: boolean;
    reviewStatus: "approved" | "pending" | "rejected";
    stripeConnected: boolean;
    stripeReady: boolean;
    stripeCapabilityStatus: string;
    stripeLivemode: boolean | null;
    publicUrl: string;
    appearance: ShopAppearance;
    themePreview: ShopThemePreview;
    calCom: { webhookUrl: string; signingSecret: string; events: string[] } | null;
    emailSettings: ShopEmailSettings | null;
    stripeSettings?: { configured: boolean; webhookConfigured: boolean; environmentManaged: boolean; accountId: string | null; webhookUrl: string };
  };
  products: ShopProduct[];
  orders: ShopOrder[];
  customers: Array<{ customerId: string; email: string; name?: string | null; orderCount: number; lastPurchaseAt: string }>;
  newsletterComplianceReady: boolean;
  limits: { maxProducts: number; maxFileBytes: number; feePercent: number };
  savedProductId?: string;
};

type ProductDraft = {
  productId?: string;
  removedFileIds: string[];
  type: "digital" | "service";
  title: string;
  description: string;
  summary: string;
  fulfillmentText: string;
  bookingUrl: string;
  sessionsIncluded: string;
  intakeQuestionsText: string;
  price: string;
  active: boolean;
  cardStyle: ProductCardStyle;
};

type ShopEmailDraft = Pick<ShopEmailSettings, "mode" | "host" | "port" | "username" | "fromName" | "fromEmail" | "replyTo"> & { password: string };
function emailDraft(settings: ShopEmailSettings): ShopEmailDraft {
  const { mode, host, port, username, fromName, fromEmail, replyTo } = settings;
  return { mode, host, port, username, fromName, fromEmail, replyTo, password: "" };
}
function emailDraftChanged(draft: ShopEmailDraft | null, saved?: ShopEmailSettings | null) {
  if (!draft || !saved) return false;
  return draft.mode === "platform" ? draft.mode !== saved.mode : JSON.stringify(draft) !== JSON.stringify(emailDraft(saved));
}

export type ShopView = "products" | "design" | "settings" | "payments" | "orders" | "customers";
type ShopTableSort = { column: string; descending: boolean };
const EMPTY_ORDER_FILTERS = { query: "", customer: "", status: "all", type: "all", from: "", to: "" };
const EMPTY_CUSTOMER_FILTERS = { query: "", purchases: "all", from: "", to: "" };

type ShopPreviewProduct = Pick<ShopProduct, "productId" | "type" | "title" | "description" | "summary" | "priceCents" | "cardStyle" | "coverUrl" | "file" | "files">;

type PhraseTranslator = (english: string, italian?: string) => string;
const tr: PhraseTranslator = (english) => english;
const locale = "en-US";

function storefrontCopy(tr: PhraseTranslator) {
  return {
    shop: tr("Shop", "Shop"),
    defaultDescription: "",
    defaultHomeDescription: tr("Discover products and services.", "Scopri prodotti e servizi."),
    placeholderProduct: tr("Your first product", "Il tuo primo prodotto"),
    placeholderDescription: tr(
      "A clear description of what the customer receives.",
      "Una descrizione chiara di ciò che riceve il cliente.",
    ),
    digitalDownload: tr("Digital download", "Download digitale"),
    service: tr("Service", "Servizio"),
    buy: tr("Buy", "Acquista"),
    searchProducts: tr("Search products", "Cerca prodotti"),
    back: tr("Back to the page", "Torna alla pagina"),
    empty: tr("No products available.", "Nessun prodotto disponibile."),
    securePayments: tr("Secure payments with Stripe", "Pagamenti sicuri con Stripe"),
    oneSession: tr("1 session included", "1 sessione inclusa"),
    sessions: tr("{count} sessions included", "{count} sessioni incluse"),
    newsletterTitle: tr("Join the newsletter", "Iscriviti alla newsletter"),
    newsletterDescription: tr("Get useful updates by email.", "Ricevi aggiornamenti utili via email."),
    subscribe: tr("Subscribe", "Iscriviti"),
  };
}

export class ShopRequestError extends Error {
  readonly code: string;

  constructor(message: string, code = "SHOP_REQUEST_FAILED") {
    super(message);
    this.name = "ShopRequestError";
    this.code = code;
  }
}

// Shared Button utility classes; browser regression checks parity with the OSS variants.
const SAVE_BUTTON_BASE = "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const SAVE_BUTTON_PRIMARY = `${SAVE_BUTTON_BASE} bg-primary text-primary-foreground hover:bg-primary/90 glow-effect h-9 rounded-md px-3`;
const SAVE_BUTTON_OUTLINE = `${SAVE_BUTTON_BASE} border border-border/70 bg-card/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors h-9 rounded-md px-3`;

const EMPTY_PRODUCT: ProductDraft = {
  removedFileIds: [],
  type: "digital",
  title: "",
  description: "",
  summary: "",
  fulfillmentText: "",
  bookingUrl: "",
  sessionsIncluded: "1",
  intakeQuestionsText: "",
  price: "",
  active: false,
  cardStyle: {
    backgroundColor: null,
    textColor: null,
    surfaceEffect: "inherit",
    alignment: "inherit",
  },
};

function money(cents: number, locale: Locale = "en-US") {
  const language = locale;
  return new Intl.NumberFormat(language, { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function colorAlpha(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, opacity))})`;
}

function ShopColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="shop-color-field">
      <span>{label}</span>
      <ColorPicker disabled={disabled} label={label} onChange={onChange} value={value} />
    </div>
  );
}

function shopDate(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const language = locale;
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function inShopDateRange(value: string, from: string, to: string) {
  const time = Date.parse(value);
  return (!from || time >= Date.parse(`${from}T00:00:00`)) && (!to || time <= Date.parse(`${to}T23:59:59.999`));
}

function ShopSortHeader({ column, label, sort, onSort, numeric = false }: { column: string; label: string; sort: ShopTableSort; onSort: (column: string) => void; numeric?: boolean }) {
  const active = sort.column === column;
  return <th aria-sort={active ? sort.descending ? "descending" : "ascending" : "none"} className={numeric ? "shop-catalog-price" : undefined} scope="col"><button aria-label={`Sort by ${label.toLowerCase()}`} onClick={() => onSort(column)} type="button">{label}{active ? sort.descending ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : <ArrowUpDown size={14} />}</button></th>;
}

const SHOP_TEXT_FONTS = [
  ["Inter, system-ui, sans-serif", "Inter"], ["Arial, Helvetica, sans-serif", "Arial"],
  ["Helvetica, Arial, sans-serif", "Helvetica"], ["Georgia, serif", "Georgia"],
  ["'Times New Roman', Times, serif", "Times New Roman"], ["'Courier New', Courier, monospace", "Courier New"],
  ["Verdana, Geneva, sans-serif", "Verdana"],
];

function shopIdentity(appearance: ShopAppearance) {
  return {
    title: appearance.title, description: appearance.description,
    showTitle: appearance.showTitle, showDescription: appearance.showDescription,
    titleFontFamily: appearance.titleFontFamily, titleFontSize: appearance.titleFontSize,
    titleFontWeight: appearance.titleFontWeight, titleColor: appearance.titleColor,
    descriptionFontFamily: appearance.descriptionFontFamily, descriptionFontSize: appearance.descriptionFontSize,
    descriptionFontWeight: appearance.descriptionFontWeight, descriptionColor: appearance.descriptionColor,
  };
}

function ShopIdentityDialog({ appearance, design, busy, onClose, onSave }: {
  appearance: ShopAppearance;
  design: ShopThemePreview;
  busy: boolean;
  onClose: () => void;
  onSave: (appearance: ShopAppearance) => Promise<void>;
}) {
  const [draft, setDraft] = useState(appearance);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"title" | "description">("title");
  const font = `${tab}FontFamily` as const;
  const size = `${tab}FontSize` as const;
  const weight = `${tab}FontWeight` as const;
  const color = `${tab}Color` as const;
  const visibility = tab === "title" ? "showTitle" : "showDescription";
  const visible = draft[visibility] !== false;
  const dirty = JSON.stringify(shopIdentity(draft)) !== JSON.stringify(shopIdentity(appearance));
  return <ShopDialog busy={busy} dirty={dirty} onClose={onClose} title="Shop title and description">
    <p>Hidden or empty text does not appear in your Shop.</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !dirty) return;
      setError(null);
      try { await onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() }); }
      catch (error) { setError(error instanceof Error ? error.message : "The Shop title and description could not be saved."); }
    }}>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <nav aria-label="Shop text" className="shop-settings-tabs shop-identity-tabs" role="tablist">
        {(["title", "description"] as const).map((section) => <button aria-controls={`shop-text-${section}-panel`} aria-selected={tab === section} id={`shop-text-${section}-tab`} key={section} onClick={() => setTab(section)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "title" : event.key === "End" ? "description" : section === "title" ? "description" : "title";
          setTab(next); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#shop-text-${next}-tab`)?.focus();
        }} role="tab" tabIndex={tab === section ? 0 : -1} type="button">{section === "title" ? "Title" : "Description"}</button>)}
      </nav>
      <div aria-labelledby={`shop-text-${tab}-tab`} id={`shop-text-${tab}-panel`} role="tabpanel">
        <div className="shop-identity-heading"><label htmlFor={`shop-text-${tab}`}>{tab === "title" ? "Title" : "Description"}</label><ToggleSwitch aria-label={`Show ${tab}`} checked={visible} disabled={busy} onCheckedChange={(show) => setDraft({ ...draft, [visibility]: show })} /></div>
        {tab === "title" ? <input id="shop-text-title" maxLength={80} onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} /> : <textarea id="shop-text-description" maxLength={320} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} value={draft.description} />}
        <div className="shop-identity-style">
          <label>Font<select onChange={(event) => setDraft({ ...draft, [font]: event.target.value || null })} value={draft[font] || ""}>
            <option value="">Shop font</option>{SHOP_TEXT_FONTS.map(([family, name]) => <option key={family} value={family}>{name}</option>)}
            {draft[font] && !SHOP_TEXT_FONTS.some(([family]) => family === draft[font]) && <option value={draft[font]}>Custom font</option>}
          </select></label>
          <label>Size (px)<input max={tab === "title" ? 96 : 48} min={10} onChange={(event) => setDraft({ ...draft, [size]: event.target.value ? Number(event.target.value) : null })} placeholder={tab === "title" ? "Automatic (28–40)" : "Automatic (16)"} type="number" value={draft[size] ?? ""} /></label>
          <label>Weight<select onChange={(event) => setDraft({ ...draft, [weight]: Number(event.target.value) as ShopAppearance["titleFontWeight"] })} value={draft[weight] ?? (tab === "title" ? 800 : 400)}><option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option><option value={800}>Extra bold</option></select></label>
          <div className="shop-identity-color"><div><span>Color</span><button aria-label="Use Shop color" className="shop-color-reset" disabled={!draft[color]} onClick={() => setDraft({ ...draft, [color]: null })} title="Use Shop color" type="button"><RotateCcw aria-hidden="true" size={14} /></button></div><ColorPicker label="Color" onChange={(value) => setDraft({ ...draft, [color]: value })} value={draft[color] || (tab === "title" ? design.textColor : design.mutedColor)} /></div>
        </div>
      </div>
      <footer><button className="button secondary" onClick={onClose} type="button">Cancel</button><button aria-busy={busy} className="button primary" disabled={busy || !dirty} type="submit">{busy && <LoadingIndicator size={16} />}Save</button></footer>
      </fieldset>
    </form>
  </ShopDialog>;
}

function clearLegalProfile(appearance: ShopAppearance): ShopAppearance {
  return {
    ...appearance,
    sellerType: "unset",
    sellerName: "",
    sellerEmail: "",
    sellerPhone: "",
    sellerAddress: "",
    sellerBusinessId: "",
    termsText: "",
    digitalLicenseText: "",
    privacyText: "",
    cookiePolicyText: "",
    refundPolicyText: "",
    withdrawalText: "",
    termsUrl: "",
    digitalLicenseUrl: "",
    privacyUrl: "",
    cookiePolicyUrl: "",
    refundPolicyUrl: "",
    withdrawalUrl: "",
    sellerSelfCertified: false,
  };
}

function ShopStorefrontPreview({
  appearance,
  design,
  products,
  surface,
  copy,
  publicUrl,
  device,
  selectedProductId,
  disabled,
  canAddProduct,
  onSelectProduct,
  onAddProduct,
  onEditLogo,
  onEditBackLink,
  onEditIdentity,
}: {
  appearance: ShopAppearance;
  design: ShopThemePreview;
  products: ShopPreviewProduct[];
  surface: string;
  copy: ReturnType<typeof storefrontCopy>;
  publicUrl: string;
  device: "desktop" | "mobile";
  selectedProductId?: string;
  disabled: boolean;
  canAddProduct: boolean;
  onSelectProduct: (productId: string) => void;
  onAddProduct: () => void;
  onEditLogo: () => void;
  onEditBackLink: () => void;
  onEditIdentity: () => void;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null);
  const detailsProduct = products.find((product) => product.productId === detailsProductId);
  const digitalLicense = shopPolicies(appearance, publicUrl).find((policy) => policy.slug === "digital-license");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const sourceWidth = device === "desktop" ? 1280 : 390;
  const scale = viewport.width / sourceWidth;
  const title = appearance.showTitle !== false ? appearance.title : "";
  const description = appearance.showDescription !== false ? appearance.description : "";
  const compactHeader = !title && !description;
  const search = products.length > 0 && <div aria-hidden="true" className="shop-preview-search"><Search size={15} />{copy.searchProducts}</div>;
  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const observer = new ResizeObserver(() => setViewport({ width: screen.clientWidth, height: screen.clientHeight }));
    observer.observe(screen);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`shop-device-frame ${device}`} data-preview-device={device}>
      <div className="shop-device-hardware">
        {device === "desktop" ? <div aria-hidden="true" className="shop-device-browser"><span>● ● ●</span><small>{publicUrl.replace(/^https?:\/\//, "")}</small></div> : <span aria-hidden="true" className="shop-device-island" />}
        <div className="shop-device-screen" ref={screenRef}>
          <div className="shop-device-viewport" data-preview-source-width={sourceWidth} style={{ width: sourceWidth, height: scale ? viewport.height / scale : undefined, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
    <div
      className="shop-design-preview"
      data-shop-preview-locale="en"
      dir="ltr"
      lang="en"
      style={{
        "--shop-preview-bg": design.pageBackground,
        "--shop-preview-bg-secondary": design.pageBackgroundSecondary,
        "--shop-preview-ink": design.textColor,
        "--shop-preview-muted": design.mutedColor,
        "--shop-preview-accent": design.accentColor,
        "--shop-preview-button-ink": design.buttonTextColor,
        "--shop-preview-card": surface,
        "--shop-preview-card-ink": design.cardTextColor,
        "--shop-preview-line": design.borderColor,
        "--shop-preview-radius": `${appearance.inheritPageTheme ? design.cardRadius : appearance.cardRadius}px`,
        "--shop-preview-shadow": `0 ${Math.round(4 + appearance.shadowIntensity * .12)}px ${Math.round(10 + appearance.shadowIntensity * .34)}px rgba(4,12,28,${appearance.shadowIntensity / 250})`,
        "--shop-preview-font": design.fontFamily,
        "--shop-title-font": appearance.titleFontFamily || design.fontFamily,
        "--shop-title-size": appearance.titleFontSize ? `${appearance.titleFontSize}px` : "clamp(28px, 3.6cqw, 40px)",
        "--shop-title-weight": appearance.titleFontWeight ?? 800,
        "--shop-title-color": appearance.titleColor || design.textColor,
        "--shop-description-font": appearance.descriptionFontFamily || design.fontFamily,
        "--shop-description-size": `${appearance.descriptionFontSize ?? 16}px`,
        "--shop-description-weight": appearance.descriptionFontWeight ?? 400,
        "--shop-description-color": appearance.descriptionColor || design.mutedColor,
      } as CSSProperties}
    >
      <div className={`shop-preview-topbar${compactHeader ? " centered-logo" : ""}`}><button aria-label="Edit back link" className="shop-preview-back" disabled={disabled} onClick={onEditBackLink} type="button"><span>← {appearance.backLinkLabel || copy.back}</span></button><button aria-label="Edit shop logo" className="shop-preview-logo" disabled={disabled} onClick={onEditLogo} type="button">{appearance.logoUrl ? <img alt="Shop logo" src={new URL(appearance.logoUrl, publicUrl).toString()} /> : <><ShoppingCart aria-hidden="true" size={17} />{copy.shop}</>}</button>{compactHeader && search}</div>
      {!compactHeader && <header className="shop-preview-hero">
        <div className={`shop-preview-heading${title && products.length > 0 ? " with-search" : ""}`}>
          {title && <h4 aria-label={title}><button aria-label="Edit Shop title" className="shop-preview-text" disabled={disabled} onClick={onEditIdentity} type="button">{title}</button></h4>}
          {search}
        </div>
        {description && <div className="shop-preview-introduction"><button aria-label="Edit Shop description" className="shop-preview-text" disabled={disabled} onClick={onEditIdentity} type="button">{description}</button></div>}
      </header>}
      <div className={`shop-preview-products ${appearance.layout} ${appearance.alignment}`}>
        {products.map((product) => {
          const cardStyle = product.cardStyle || EMPTY_PRODUCT.cardStyle;
          return (
            <article
              aria-label={`View details for ${product.title}`}
              aria-haspopup="dialog"
              data-selected={selectedProductId === product.productId}
              aria-disabled={disabled}
              className={`${product.coverUrl ? "has-cover" : "no-cover"} ${cardStyle.surfaceEffect === "inherit" ? appearance.cardEffect : cardStyle.surfaceEffect} ${cardStyle.alignment === "inherit" ? appearance.alignment : cardStyle.alignment}`}
              key={product.productId}
              onClick={() => { if (!disabled) setDetailsProductId(product.productId); }}
              onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setDetailsProductId(product.productId); } }}
              role="button"
              tabIndex={disabled ? -1 : 0}
              style={{
                "--shop-product-preview-card": cardStyle.backgroundColor || surface,
                "--shop-product-preview-ink": cardStyle.textColor || design.cardTextColor,
              } as CSSProperties}
            >
              {product.coverUrl && <img alt="" className="shop-preview-cover" src={new URL(product.coverUrl, publicUrl).toString()} />}
              {appearance.showProductType && <small>{product.type === "digital" ? copy.digitalDownload : copy.service}</small>}
              <strong>{product.title}</strong>
              <div className="shop-preview-summary" dangerouslySetInnerHTML={{ __html: renderShopDescription(shopProductSummary(product)) }} />
              <div><b>{money(product.priceCents, "en")}</b><span>{copy.buy}</span></div>
            </article>
          );
        })}
        {!products.length && <div className="shop-preview-empty"><ShoppingBag size={36} /><strong>No products available</strong><button className="button primary" disabled={disabled || !canAddProduct} onClick={onAddProduct} type="button"><PackagePlus size={16} /> Add product</button></div>}
      </div>
      {appearance.newsletterEnabled && <section className="shop-preview-newsletter">
        <MailPlus aria-hidden="true" size={22} />
        <div><strong>{copy.newsletterTitle}</strong><p>{copy.newsletterDescription}</p></div>
        <span>Email</span><b>{copy.subscribe}</b>
      </section>}
      <footer className="shop-preview-footer"><nav aria-label="Shop policies">{shopPolicies(appearance, publicUrl).map((policy) => <a href={policy.url} key={policy.slug} rel="noreferrer" target="_blank">{policy.title}</a>)}</nav>{copy.securePayments} · OrbitPage</footer>
    </div>
          </div>
        </div>
      </div>
      {detailsProduct && <ShopDialog className="shop-product-preview-dialog" onClose={() => setDetailsProductId(null)} title={detailsProduct.title} style={{
        "--ink": design.cardTextColor, "--muted": `color-mix(in srgb, ${design.cardTextColor} 68%, transparent)`, "--line": design.borderColor,
        "--brand": design.accentColor, "--button-ink": design.buttonTextColor,
        "--surface": design.cardBackground, "--radius": `${design.cardRadius}px`, fontFamily: design.fontFamily,
      } as CSSProperties}>
        {detailsProduct.coverUrl && <img alt={detailsProduct.title} className="shop-product-detail-cover" src={new URL(detailsProduct.coverUrl, publicUrl).toString()} />}
        <div className="shop-product-detail-body">
          <h2>{detailsProduct.title}</h2>
          <div className="shop-product-detail-description" dangerouslySetInnerHTML={{ __html: renderShopDescription(detailsProduct.description) }} />
          {detailsProduct.type === "digital" && <p className="shop-product-detail-files">{(detailsProduct.files?.length ? detailsProduct.files : detailsProduct.file ? [detailsProduct.file] : []).map((file) => file.filename).join(" · ")}</p>}
          <div className="shop-product-detail-checkout">
            {detailsProduct.type === "digital" && digitalLicense && (appearance.digitalLicenseText || appearance.digitalLicenseUrl) && <p><a href={digitalLicense.url} rel="noreferrer" target="_blank">{digitalLicense.title}</a></p>}
            <label><input disabled type="checkbox" /><span>{appearance.sellerType === "private"
              ? "I understand that the page owner is the seller and has declared they are not a trader. EU consumer protection rights do not apply to this contract."
              : "I understand that the page owner is the seller. Any seller policies shown on this page apply; my statutory rights are not waived."}</span></label>
            {detailsProduct.type === "digital" && <label><input disabled type="checkbox" /><span>I expressly consent to immediate supply of the digital content and acknowledge that I lose my withdrawal right once the download begins.</span></label>}
            <div className="shop-product-detail-price"><strong>{money(detailsProduct.priceCents, "en")}</strong><button disabled type="button">{copy.buy}</button></div>
          </div>
          <footer className="shop-product-detail-edit"><button disabled={disabled} onClick={() => { onSelectProduct(detailsProduct.productId); setDetailsProductId(null); }} type="button">Edit product<ArrowUpRight size={16} /></button></footer>
        </div>
      </ShopDialog>}
    </div>
  );
}

function productDraft(product: ShopProduct): ProductDraft {
  return {
    productId: product.productId,
    removedFileIds: [],
    type: product.type,
    title: product.title,
    description: product.description,
    summary: shopProductSummary(product),
    fulfillmentText: product.fulfillmentText,
    bookingUrl: product.bookingUrl || "",
    sessionsIncluded: String(product.sessionsIncluded || 1),
    intakeQuestionsText: (product.intakeQuestions || []).map((question) => `${question.prompt}${question.required ? " *" : ""}`).join("\n"),
    price: (product.priceCents / 100).toFixed(2),
    active: product.active,
    cardStyle: product.cardStyle || EMPTY_PRODUCT.cardStyle,
  };
}

function shopFileContentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  return {
    pdf: "application/pdf",
    zip: "application/zip",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    avif: "image/avif",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
  }[extension || ""] || "application/octet-stream";
}

function uploadWithProgress(url: string, body: File, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.timeout = 10 * 60_000;
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The file upload did not complete. Please try again."));
    request.onerror = request.ontimeout = request.onabort = () => reject(new Error("The upload was interrupted. Your remaining files are kept for retry."));
    request.send(body);
  });
}

const SHOP_THEMES = [
  { name: "Studio", pageBackground: "#f4f7fb", textColor: "#0c1528", mutedColor: "#5f6d83", accentColor: "#3568f4", buttonTextColor: "#ffffff", cardBackground: "#ffffff", cardTextColor: "#0c1528", borderColor: "#d8dfeb" },
  { name: "Midnight", pageBackground: "#111827", textColor: "#f8fafc", mutedColor: "#a9b5c6", accentColor: "#93c5fd", buttonTextColor: "#111827", cardBackground: "#1e293b", cardTextColor: "#f8fafc", borderColor: "#334155" },
  { name: "Botanical", pageBackground: "#edf5ef", textColor: "#173f32", mutedColor: "#557467", accentColor: "#246b50", buttonTextColor: "#ffffff", cardBackground: "#ffffff", cardTextColor: "#173f32", borderColor: "#c9ddce" },
  { name: "Clay", pageBackground: "#fff5ee", textColor: "#452d25", mutedColor: "#856454", accentColor: "#b74c31", buttonTextColor: "#ffffff", cardBackground: "#fffdfb", cardTextColor: "#452d25", borderColor: "#eacfc1" },
  { name: "Ocean", pageBackground: "#eef7fa", textColor: "#153b4a", mutedColor: "#557480", accentColor: "#126e87", buttonTextColor: "#ffffff", cardBackground: "#ffffff", cardTextColor: "#153b4a", borderColor: "#c9e2ea" },
  { name: "Lavender", pageBackground: "#f5f1fb", textColor: "#39275a", mutedColor: "#76618b", accentColor: "#7250a5", buttonTextColor: "#ffffff", cardBackground: "#ffffff", cardTextColor: "#39275a", borderColor: "#ddd1ed" },
];

export type ShopRequest = <T>(input: string, init?: RequestInit) => Promise<T>;
export type ShopClientProps = {
  request: ShopRequest;
  documentationUrl: (section: string) => string;
  onBackToContent: () => void; onViewPlans: () => void;
  embedded?: boolean; onStatusChange?: (enabled: boolean) => void;
  isHomepage?: boolean; selectedView?: ShopView | "legal";
  onViewChange?: (view: ShopView | "legal") => void;
  selfHosted?: boolean;
};

function OwnerStripeSettings({ request, saved, onSaved }: { request: ShopRequest; saved: NonNullable<ShopDashboard["shop"]>["stripeSettings"]; onSaved: (data: ShopDashboard) => void }) {
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      onSaved(await request<ShopDashboard>("/api/shop/stripe", { method: "POST", body: JSON.stringify({ secretKey, webhookSecret }) }));
      setSecretKey(""); setWebhookSecret("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Stripe settings could not be saved."); }
    finally { setBusy(false); }
  }
  return <form className="shop-provider-form" onSubmit={event => void save(event)}>
    <p>Use your own Stripe account. Payments and payouts stay with that account, with no OrbitPage fee.</p>
    {saved?.environmentManaged ? <p>Stripe credentials are configured through server environment variables.</p> : <fieldset disabled={busy}>
      <div className="shop-option-grid">
        <label>Stripe secret API key<input autoComplete="new-password" maxLength={300} onChange={event => setSecretKey(event.target.value)} placeholder={saved?.configured ? "Saved key · leave blank to keep" : "sk_test_… or sk_live_…"} required={!saved?.configured} spellCheck={false} type="password" value={secretKey} /></label>
        <label>Webhook signing secret<input autoComplete="new-password" maxLength={300} onChange={event => setWebhookSecret(event.target.value)} placeholder={saved?.webhookConfigured ? "Saved secret · leave blank to keep" : "whsec_…"} spellCheck={false} type="password" value={webhookSecret} /></label>
      </div>
      <button className="button primary" disabled={busy} type="submit">{busy ? <LoadingIndicator size={16} /> : <Save size={16} />} Save and verify Stripe</button>
    </fieldset>}
    {saved?.webhookUrl && <div className="shop-calendar-field"><label htmlFor="shop-stripe-webhook-url">Stripe webhook endpoint</label><input id="shop-stripe-webhook-url" onFocus={event => event.currentTarget.select()} readOnly value={saved.webhookUrl} /></div>}
    <p className="shop-provider-muted">Create a webhook in the same Stripe account and mode. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded, charge.dispute.created and charge.dispute.closed.</p>
    {saved?.accountId && <small>Account: {saved.accountId}</small>}
    {error && <p className="shop-feedback error" role="alert">{error}</p>}
  </form>;
}

export default function ShopClient({
  request, documentationUrl, onBackToContent, onViewPlans,
  embedded = false, onStatusChange, isHomepage = false, selectedView, onViewChange,
  selfHosted = false,
}: ShopClientProps) {
  const [data, setData] = useState<ShopDashboard | null>(null);
  const dashboardRef = useRef(data);
  const [stripeCheckFailed, setStripeCheckFailed] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_PRODUCT);
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const productNameRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [localView, setLocalView] = useState<ShopView>("products");
  const requestedView = selectedView || localView;
  const view = requestedView === "legal" || requestedView === "payments" ? "settings" : requestedView;
  const setView = useCallback((next: ShopView) => { setLocalView(next); onViewChange?.(next); }, [onViewChange]);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [appearance, setAppearance] = useState<ShopAppearance | null>(null);
  const [policyDrafts, setPolicyDrafts] = useState<Partial<Record<typeof SHOP_POLICIES[number]["slug"], { source: "hosted" | "external"; text: string; url: string }>>>({});
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string; code?: string } | null>(null);
  const [copiedCalendarField, setCopiedCalendarField] = useState<"url" | "secret" | null>(null);
  const [calendarCopyError, setCalendarCopyError] = useState("");
  const [settingsTab, setSettingsTab] = useState<"compliance" | "stripe" | "calendar" | "checkout" | "email">("compliance");
  const [smtpDraft, setSmtpDraft] = useState<ShopEmailDraft | null>(null);
  const [themeMode, setThemeMode] = useState<"presets" | "custom">("presets");
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [backLinkDialogOpen, setBackLinkDialogOpen] = useState(false);
  const [backLinkDraft, setBackLinkDraft] = useState("");
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Array<{ name: string; size: number; loaded: number; status: "waiting" | "uploading" | "verifying" | "complete" | "error" }>>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [catalogType, setCatalogType] = useState("all");
  const [catalogSort, setCatalogSort] = useState("title");
  const [catalogMinPrice, setCatalogMinPrice] = useState("");
  const [catalogMaxPrice, setCatalogMaxPrice] = useState("");
  const [orderFilters, setOrderFilters] = useState(EMPTY_ORDER_FILTERS);
  const [customerFilters, setCustomerFilters] = useState(EMPTY_CUSTOMER_FILTERS);
  const [orderSort, setOrderSort] = useState<ShopTableSort>({ column: "date", descending: true });
  const [customerSort, setCustomerSort] = useState<ShopTableSort>({ column: "date", descending: true });
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [deleteProductPending, setDeleteProductPending] = useState(false);
  const [deleteProfilePending, setDeleteProfilePending] = useState(false);
  useEffect(() => { if (requestedView === "payments") setSettingsTab("stripe"); if (requestedView === "legal") setSettingsTab("compliance"); }, [requestedView]);
  useEffect(() => {
    if (!logoFile) { setLogoPreviewUrl(null); return; }
    const url = URL.createObjectURL(logoFile); setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setDevice("mobile");
  }, []);

  const maxFileLabel = useMemo(() => fileSize(data?.limits.maxFileBytes || 0), [data?.limits.maxFileBytes]);
  const savedProductFiles = (data?.products.find(product => product.productId === draft.productId)?.files || []).filter(file => !draft.removedFileIds.includes(file.id));
  const previewCopy = storefrontCopy((english) => english);
  const previewInstructions = "Click a product to preview its details. Click the title, description, logo or back link to edit.";

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setData(await request<ShopDashboard>(`/api/shop${refresh ? "?refresh=1" : ""}`));
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "The shop could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load(new URLSearchParams(window.location.search).has("connect"));
    if (new URLSearchParams(window.location.search).has("connect")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connect");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setView("payments");
    }
  }, [load, setView]);

  useEffect(() => { dashboardRef.current = data; }, [data]);

  useEffect(() => {
    if (view !== "settings" || settingsTab !== "stripe" || !data?.shop?.stripeConnected || action !== null) return;
    let cancelled = false, pending = false;
    const refresh = async () => {
      if (cancelled || pending || document.visibilityState !== "visible") return;
      pending = true;
      const snapshot = dashboardRef.current;
      try {
        const next = await request<ShopDashboard>("/api/shop?refresh=1");
        // A status response must not overwrite a newer save.
        if (!cancelled && dashboardRef.current === snapshot) {
          setData(current => current === snapshot && current ? { ...current, mode: next.mode, shop: next.shop } : current);
          setStripeCheckFailed(false);
        }
      } catch {
        if (!cancelled && dashboardRef.current === snapshot) setStripeCheckFailed(true);
      } finally { pending = false; }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [request, view, settingsTab, action, data?.shop?.stripeConnected]);

  useEffect(() => {
    if (data?.shop?.enabled !== undefined) onStatusChange?.(data.shop.enabled);
  }, [data?.shop?.enabled, onStatusChange]);

  useEffect(() => {
    const saved = data?.shop?.appearance;
    if (saved) setAppearance((current) => current || saved);
  }, [data?.shop?.appearance]);

  useEffect(() => {
    const saved = data?.shop?.emailSettings;
    if (saved) setSmtpDraft(current => current || emailDraft(saved));
  }, [data?.shop?.emailSettings]);

  useEffect(() => {
    const original = data?.products.find((product) => product.productId === draft.productId);
    const dirty = Boolean(emailDraftChanged(smtpDraft, data?.shop?.emailSettings) || logoFile || deleteProfilePending || (appearance && JSON.stringify(appearance) !== JSON.stringify(data?.shop?.appearance)) || (productEditorOpen && (deleteProductPending || files.length || cover || JSON.stringify(draft) !== JSON.stringify(original ? productDraft(original) : EMPTY_PRODUCT))));
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [appearance, data, draft, smtpDraft, productEditorOpen, files, cover, logoFile, deleteProfilePending, deleteProductPending]);

  useEffect(() => {
    if (view === "products" && productEditorOpen) productNameRef.current?.focus();
  }, [productEditorOpen, view]);

  useEffect(() => {
    if (!cover) {
      setCoverPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(cover);
    setCoverPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [cover]);

  function canSwitchProduct() {
    const original = data?.products.find((product) => product.productId === draft.productId);
    const changed = productEditorOpen && (deleteProductPending || files.length || cover || JSON.stringify(draft) !== JSON.stringify(original ? productDraft(original) : EMPTY_PRODUCT));
    return !changed || window.confirm("Discard the unsaved product changes?");
  }

  function selectProduct(productId: string) {
    if (productEditorOpen && (draft.productId || "draft-product") === productId) { setView("products"); setCatalogOpen(false); return; }
    const product = data?.products.find((item) => item.productId === productId);
    if (!product || !canSwitchProduct()) return;
    setDraft(productDraft(product));
    setFiles([]);
    setCover(null);
    setDeleteProductPending(false);
    setUploadProgress([]);
    setCatalogOpen(false);
    setView("products");
    setProductEditorOpen(true);
  }

  function openNewProduct() {
    if (action !== null || !data || data.products.length >= data.limits.maxProducts) return;
    if (!canSwitchProduct()) return;
    setView("products");
    setDraft(EMPTY_PRODUCT);
    setFiles([]);
    setCover(null);
    setDeleteProductPending(false);
    setUploadProgress([]);
    setProductEditorOpen(true);
  }

  function closeProductEditor() {
    setDraft(EMPTY_PRODUCT);
    setFiles([]);
    setCover(null);
    setProductEditorOpen(false);
    setDeleteProductPending(false);
  }

  async function connectStripe() {
    setAction("connect");
    setFeedback(null);
    try {
      const result = await request<{ url: string }>("/api/shop/connect", { method: "POST", body: "{}" });
      const destination = new URL(result.url);
      if (destination.protocol !== "https:" || !(destination.hostname === "stripe.com" || destination.hostname.endsWith(".stripe.com"))) {
        throw new Error("Stripe returned an invalid onboarding address.");
      }
      window.location.assign(destination.toString());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Stripe could not be connected.",
        code: error instanceof ShopRequestError ? error.code : undefined,
      });
      setAction(null);
    }
  }

  async function refreshStripeConnection() {
    setAction("refresh-status");
    setFeedback(null);
    try {
      const next = await request<ShopDashboard>("/api/shop?refresh=1");
      setData(next);
      setStripeCheckFailed(false);
      setFeedback(next.shop?.stripeReady
        ? { type: "success", text: "Stripe is ready. You can publish the shop." }
        : { type: "error", text: "Stripe is still completing the account verification. Check again shortly." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Stripe status could not be refreshed.",
        code: error instanceof ShopRequestError ? error.code : undefined,
      });
    } finally {
      setAction(null);
    }
  }

  async function uploadProductFile(productId: string, selected: File, kind: "file" | "cover", index: number) {
    const update = (patch: Partial<(typeof uploadProgress)[number]>) => setUploadProgress((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
    update({ status: "uploading" });
    try {
      const reservation = await request<{
        uploadToken: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>("/api/shop/uploads/reserve", {
        method: "POST",
        body: JSON.stringify({ productId, filename: selected.name, contentType: shopFileContentType(selected), sizeBytes: selected.size, kind }),
      });
      try {
        await uploadWithProgress(reservation.uploadUrl, selected, reservation.headers, (loaded) => update({ loaded }));
        update({ status: "verifying", loaded: selected.size });
        const result = await request<ShopDashboard>("/api/shop/uploads/finalize", {
          method: "POST",
          body: JSON.stringify({ uploadToken: reservation.uploadToken }),
        });
        update({ status: "complete" });
        return result;
      } catch (error) {
        await request("/api/shop/uploads/abort", { method: "POST", body: JSON.stringify({ uploadToken: reservation.uploadToken }) }).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      update({ status: "error" });
      throw error;
    }
  }

  async function saveProduct(event?: FormEvent) {
    event?.preventDefault();
    const price = Number.parseFloat(draft.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 1) {
      setFeedback({ type: "error", text: "Enter a price of at least €1.00." });
      return;
    }
    const existingHasFile = savedProductFiles.length > 0;
    if (draft.type === "digital" && draft.active && !existingHasFile && !files.length) {
      setFeedback({ type: "error", text: "Choose the file customers will receive." });
      return;
    }
    const existingCount = savedProductFiles.length;
    if (files.length + existingCount > 10 || files.some((item) => item.size === 0 || item.size > (data?.limits.maxFileBytes || 0))) {
      setFeedback({ type: "error", text: `Choose up to ${10 - existingCount} additional files, each no larger than ${maxFileLabel}.` });
      return;
    }
    if (cover && (cover.size === 0 || cover.size > 5 * 1024 * 1024)) {
      setFeedback({ type: "error", text: "Choose a cover image of 5 MB or less." });
      return;
    }
    setAction("save-product");
    setUploadProgress([...files, ...(cover ? [cover] : [])].map((file) => ({ name: file.name, size: file.size, loaded: 0, status: "waiting" })));
    if (files.length || cover) setFilesDialogOpen(true);
    setFeedback(null);
    try {
      let next = await request<ShopDashboard>("/api/shop/products", {
        method: "POST",
        body: JSON.stringify({
          ...(draft.productId ? { productId: draft.productId } : {}),
          removedFileIds: draft.removedFileIds,
          type: draft.type,
          title: draft.title,
          description: draft.description,
          summary: draft.summary,
          fulfillmentText: draft.type === "service" ? draft.fulfillmentText : "",
          bookingUrl: draft.type === "service" ? draft.bookingUrl : "",
          sessionsIncluded: draft.type === "service" ? Math.max(1, Number.parseInt(draft.sessionsIncluded, 10) || 1) : 1,
          intakeQuestions: draft.type === "service" ? draft.intakeQuestionsText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12).map((line, index) => ({
            id: `q${index + 1}`,
            prompt: line.endsWith("*") ? line.slice(0, -1).trim() : line,
            required: line.endsWith("*"),
          })) : [],
          priceCents: Math.round(price * 100),
          active: draft.type === "digital" && !existingHasFile ? false : draft.active,
          cardStyle: draft.cardStyle,
        }),
      });
      const productId = draft.productId || next.savedProductId;
      if (!productId) throw new Error("The product could not be identified after saving.");
      setDraft((current) => ({ ...current, productId, removedFileIds: [] }));
      setData(next);
      for (const [index, file] of files.entries()) {
        next = await uploadProductFile(productId, file, "file", index);
        setData(next);
        setFiles((pending) => pending.filter((item) => item !== file));
      }
      if (cover) {
        next = await uploadProductFile(productId, cover, "cover", files.length);
        setData(next);
        setCover(null);
      }
      if (draft.active && draft.type === "digital" && !existingHasFile) {
        next = await request<ShopDashboard>("/api/shop/products", {
          method: "POST",
          body: JSON.stringify({
            productId,
            type: draft.type,
            title: draft.title,
            description: draft.description,
            summary: draft.summary,
            fulfillmentText: "",
            bookingUrl: "",
            sessionsIncluded: 1,
            intakeQuestions: [],
            priceCents: Math.round(price * 100),
            active: true,
            cardStyle: draft.cardStyle,
          }),
        });
      }
      setData(next);
      closeProductEditor();
      setFeedback({ type: "success", text: "Product saved securely." });
      return true;
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "The product could not be saved." });
      setUploadProgress((items) => items.map((item) => item.status === "uploading" || item.status === "verifying" ? { ...item, status: "error" } : item));
    } finally {
      setAction(null);
    }
  }

  async function deleteProduct(product: ShopProduct) {
    if (!window.confirm(`Delete “${product.title}”? Existing paid orders remain in your records.`)) return;
    setAction(`delete:${product.productId}`);
    setFeedback(null);
    try {
      setData(await request<ShopDashboard>(`/api/shop/products/${encodeURIComponent(product.productId)}`, { method: "DELETE" }));
      if (draft.productId === product.productId) closeProductEditor();
      setFeedback({ type: "success", text: "Product deleted." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "The product could not be deleted." });
    } finally {
      setAction(null);
    }
  }

  async function copyCalendarValue(field: "url" | "secret", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCalendarField(field);
      setCalendarCopyError("");
    } catch {
      setCopiedCalendarField(null);
      setCalendarCopyError("Clipboard unavailable. Select the value and copy it manually.");
    }
  }

  async function deleteCustomerData(customer: ShopDashboard["customers"][number]) {
    if (!window.confirm(`Permanently delete the OrbitPage data for ${customer.email}? Their private Shop access, downloads, questionnaires and bookings will be removed. Financial transaction records will remain anonymized, and Stripe may retain payment records where legally required.`)) return;
    setAction(`delete-customer:${customer.customerId}`);
    setFeedback(null);
    try {
      setData(await request<ShopDashboard>(`/api/shop/customers/${encodeURIComponent(customer.customerId)}`, { method: "DELETE" }));
      setFeedback({ type: "success", text: "Customer data deleted. Financial records were anonymized." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "The customer data could not be deleted." });
    } finally {
      setAction(null);
    }
  }

  function openLegalProfile() {
    setFeedback(null);
    setSettingsTab("compliance");
    setView("settings");
  }

  async function togglePublication() {
    if (!data?.shop) return;
    const wasEnabled = data.shop.enabled;
    if (wasEnabled && isHomepage) {
      setFeedback({ type: "error", text: tr("Choose another homepage before deactivating Shop.", "Scegli un'altra homepage prima di disattivare lo Shop.") });
      return;
    }
    if (wasEnabled && !window.confirm(tr(
      "Deactivate Shop? Products and orders stay saved, but the storefront will no longer be public.",
      "Disattivare lo Shop? Prodotti e ordini restano salvati, ma la vetrina non sarà più pubblica.",
    ))) return;
    setAction("publish");
    setFeedback(null);
    try {
      if (!wasEnabled && appearance) {
        const saved = await request<ShopDashboard>("/api/shop/appearance", {
          method: "POST",
          body: JSON.stringify(appearance),
        });
        setData(saved);
        setAppearance(saved.shop?.appearance || appearance);
        setPolicyDrafts({});
      }
      setData(await request<ShopDashboard>(`/api/shop/${wasEnabled ? "unpublish" : "publish"}`, { method: "POST", body: "{}" }));
      setFeedback({ type: "success", text: wasEnabled ? "Shop removed from your public page." : "Shop published successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "The shop could not be published.",
        code: error instanceof ShopRequestError ? error.code : undefined,
      });
    } finally {
      setAction(null);
    }
  }

  async function saveAppearance(event?: FormEvent, legalProfile = false) {
    event?.preventDefault();
    if (!appearance) return;
    if (deleteProfilePending && !window.confirm("Save the removal of the seller profile? The Shop will also be unpublished.")) return false;
    setAction("save-appearance");
    setFeedback(null);
    try {
      if (deleteProfilePending && data?.shop?.enabled) setData(await request<ShopDashboard>("/api/shop/unpublish", { method: "POST", body: "{}" }));
      let nextAppearance = appearance;
      if (logoFile) {
        const form = new FormData(); form.set("file", logoFile);
        const result = await request<{ logoUrl: string }>("/api/shop/logo", { method: "POST", body: form });
        nextAppearance = { ...appearance, logoUrl: result.logoUrl };
        setAppearance(nextAppearance); setLogoFile(null);
      }
      const next = await request<ShopDashboard>("/api/shop/appearance", {
        method: "POST",
        body: JSON.stringify(nextAppearance),
      });
      setData(next);
      setAppearance(next.shop?.appearance || nextAppearance);
      setPolicyDrafts({});
      setDeleteProfilePending(false);
      setFeedback({
        type: "success",
        text: legalProfile
          ? next.shop?.enabled ? "Legal profile saved and published." : "Legal profile saved."
          : next.shop?.enabled ? "Shop settings saved and published." : "Shop settings saved. It will be used when you publish.",
      });
      return true;
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : legalProfile ? "The legal profile could not be saved." : "The shop design could not be saved." });
      return false;
    } finally {
      setAction(null);
    }
  }

  async function saveIdentity(draft: ShopAppearance) {
    if (!data?.shop || action !== null) return;
    setAction("save-identity");
    setFeedback(null);
    try {
      const nextAppearance = { ...data.shop.appearance, ...shopIdentity(draft) };
      const next = await request<ShopDashboard>("/api/shop/appearance", {
        method: "POST", body: JSON.stringify(nextAppearance),
      });
      const savedAppearance = next.shop?.appearance || nextAppearance;
      setData(next);
      setAppearance((current) => current ? { ...current, ...shopIdentity(savedAppearance) } : savedAppearance);
      setIdentityDialogOpen(false);
      setFeedback({ type: "success", text: next.shop?.enabled ? "Shop title and description saved and published." : "Shop title and description saved." });
    } finally {
      setAction(null);
    }
  }

  async function saveEmail() {
    if (!smtpDraft) return false;
    setAction("save-email"); setFeedback(null);
    try {
      const saved = await request<ShopEmailSettings>("/api/shop/email", {
        method: "POST", body: JSON.stringify(smtpDraft.mode === "platform" ? { mode: "platform" } : smtpDraft),
      });
      setData(current => current?.shop ? { ...current, shop: { ...current.shop, emailSettings: saved } } : current);
      setSmtpDraft(emailDraft(saved));
      setFeedback({ type: "success", text: "Shop email settings saved." });
      return true;
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Email settings could not be saved." });
      return false;
    } finally { setAction(null); }
  }

  async function testEmail() {
    if (action !== null || emailDraftChanged(smtpDraft, data?.shop?.emailSettings)) return;
    setAction("test-email"); setFeedback(null);
    try {
      const saved = await request<ShopEmailSettings>("/api/shop/email/test", { method: "POST", body: "{}" });
      setData(current => current?.shop ? { ...current, shop: { ...current.shop, emailSettings: saved } } : current);
      setFeedback({ type: "success", text: "Test email sent to your account email. Check your inbox and spam folder." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "The test email could not be sent." });
    } finally { setAction(null); }
  }

  function updatePolicy(policy: typeof SHOP_POLICIES[number], source: "hosted" | "external", value?: string) {
    if (!appearance) return;
    const previous = policyDrafts[policy.slug] || {
      source: appearance[policy.textField] || !appearance[policy.urlField] ? "hosted" : "external",
      text: appearance[policy.textField],
      url: appearance[policy.urlField],
    };
    const next = {
      source,
      text: previous.source === "hosted" ? appearance[policy.textField] : previous.text,
      url: previous.source === "external" ? appearance[policy.urlField] : previous.url,
    };
    if (value !== undefined) next[source === "hosted" ? "text" : "url"] = value;
    setPolicyDrafts((current) => ({ ...current, [policy.slug]: next }));
    setAppearance((current) => current ? {
      ...current,
      [policy.textField]: source === "hosted" ? next.text : "",
      [policy.urlField]: source === "external" ? next.url : "",
    } : current);
  }

  if (loading && !data) return <div className="shop-loading" lang="en-US" dir="ltr"><LoadingIndicator size={20} /> Loading your shop…</div>;
  if (!data) return <div className="shop-empty" lang="en-US" dir="ltr"><ShoppingBag size={30} /><h2>Shop unavailable</h2><p>Reload the page to try again.</p></div>;
  if (!data.entitled) return (
    <section className="shop-plan-lock" lang="en-US" dir="ltr">
      <div>{!embedded && <button className="shop-back-button" onClick={onBackToContent} type="button"><ChevronLeft size={16} /> Content</button>}<p className="dashboard-kicker">Digital commerce</p><h2>Sell from your OrbitPage</h2><p>Add digital downloads or bookable services without configuring Stripe keys. Shop is included with Pro.</p><ul><li>Secure Stripe checkout</li><li>Private file delivery</li><li>Orders and refunds kept in sync</li></ul><button className="button primary" onClick={onViewPlans} type="button">View Pro</button></div>
      <div className="shop-lock-visual"><ShoppingBag size={46} /><span>Your page, your shop</span><small>OrbitPage keeps 5% per successful sale.</small></div>
    </section>
  );

  const shopReady = data.mode === "stripe" && data.shop?.stripeReady && typeof data.shop.stripeLivemode === "boolean" && !stripeCheckFailed;
  const calCom = data.shop?.calCom;
  const hasAvailableProduct = data.products.some((product) => product.active);
  const sellerAcknowledged = Boolean(appearance?.sellerSelfCertified);
  const sellerDetailsIncomplete = Boolean(appearance && (
    appearance.sellerType === "unset" || !appearance.sellerName || !appearance.sellerEmail
    || (appearance.sellerType === "trader" && !appearance.sellerAddress)
    || !(appearance.termsText || appearance.termsUrl)
    || !(appearance.privacyText || appearance.privacyUrl)
    || !(appearance.refundPolicyText || appearance.refundPolicyUrl)
    || !(appearance.withdrawalText || appearance.withdrawalUrl)
  ));
  const stripeDashboardUrl = data.shop?.stripeLivemode === false
    ? "https://dashboard.stripe.com/test/dashboard"
    : "https://dashboard.stripe.com";
  const inheritedDesign = data.shop?.themePreview;
  const previewDesign = appearance
    ? appearance.inheritPageTheme && inheritedDesign
      ? inheritedDesign
      : {
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
          fontFamily: "Inter, system-ui, sans-serif",
        }
    : inheritedDesign;
  const previewSurface = appearance && previewDesign
    ? appearance.cardEffect === "transparent"
      ? "transparent"
      : appearance.cardEffect === "liquid-glass"
        ? colorAlpha(previewDesign.cardBackground, Math.min(.72, appearance.cardOpacity * .62))
        : colorAlpha(previewDesign.cardBackground, appearance.cardOpacity)
    : "#ffffff";
  const draftPrice = Math.round((Number.parseFloat(draft.price.replace(",", ".")) || 0) * 100);
  const originalProduct = data.products.find((product) => product.productId === draft.productId);
  const draftCoverUrl = coverPreviewUrl || originalProduct?.coverUrl || null;
  const liveDraftProduct: ShopPreviewProduct | null = productEditorOpen && (draft.title || draft.description || draft.price || coverPreviewUrl)
    ? {
        productId: draft.productId || "draft-product",
        type: draft.type,
        title: draft.title || previewCopy.placeholderProduct,
        description: draft.description || previewCopy.placeholderDescription,
        summary: draft.summary,
        priceCents: draftPrice,
        cardStyle: draft.cardStyle,
        coverUrl: draftCoverUrl,
        file: savedProductFiles[0] || null,
        files: [...savedProductFiles, ...files.map((file, index) => ({ id: `selected-${index}`, filename: file.name, contentType: file.type, sizeBytes: file.size }))],
      }
    : null;
  let previewProducts: ShopPreviewProduct[] = data.products.filter((product) => product.active || (productEditorOpen && draft.productId === product.productId)).map((product) => (
    liveDraftProduct?.productId === product.productId ? liveDraftProduct : product
  ));
  if (liveDraftProduct && !draft.productId) previewProducts = [liveDraftProduct, ...previewProducts];
  const addProductButton = <button aria-controls="shop-catalog" aria-expanded={productEditorOpen} aria-label="Add product" className="button primary compact shop-add-product-button" disabled={action !== null || data.products.length >= data.limits.maxProducts} onClick={openNewProduct} type="button"><PackagePlus size={16} /><span>Add product</span></button>;
  const appearanceChanged = Boolean(logoFile || deleteProfilePending || (appearance && JSON.stringify(appearance) !== JSON.stringify(data.shop?.appearance)));
  const productChanged = productEditorOpen && Boolean(deleteProductPending || files.length || cover || JSON.stringify(draft) !== JSON.stringify(originalProduct ? productDraft(originalProduct) : EMPTY_PRODUCT));
  const emailChanged = emailDraftChanged(smtpDraft, data.shop?.emailSettings);
  const changed = appearanceChanged || productChanged || emailChanged;
  const paymentMode = data.shop?.stripeConnected && typeof data.shop.stripeLivemode === "boolean" && <span className={`shop-mode-badge ${data.shop.stripeLivemode ? "live" : "test"}`}>{data.shop.stripeLivemode ? "Live payments" : "Test mode"}</span>;
  const publicationButton = (data.shop?.enabled || (hasAvailableProduct && shopReady)) && <button
        className="button primary"
        disabled={action !== null || changed}
        title={changed ? "Save or revert your changes first." : undefined}
        onClick={() => {
          if (data.shop?.enabled) return void togglePublication();
          if (!sellerAcknowledged) return openLegalProfile();
          if (!shopReady) {
            setSettingsTab("stripe");
            setView("payments");
            setFeedback({ type: "error", text: "Complete Stripe onboarding before publishing the shop." });
            return;
          }
          void togglePublication();
        }}
        type="button"
      >
        {action === "publish" ? <LoadingIndicator size={16} /> : data.shop?.enabled ? <Download size={16} /> : <UploadCloud size={16} />}
        {data.shop?.enabled ? "Unpublish" : "Publish shop"}
      </button>;
  const shopActions = (
    <div className="shop-command-actions">
      {embedded && paymentMode}
      {data.shop?.enabled && <a className="button secondary" href={data.shop.publicUrl} rel="noreferrer" target="_blank"><ArrowUpRight size={16} /> Open shop</a>}
    </div>
  );
  const productEditor = productEditorOpen ? <>
    <div className="shop-section-heading"><div><h3>{draft.productId ? "Edit product" : "Add a product"}</h3></div><div className="shop-editor-heading-actions">{originalProduct && <button aria-label="Delete product" className="shop-delete-button" disabled={action !== null || deleteProductPending} onClick={() => setDeleteProductPending(true)} type="button"><Trash2 size={16} /></button>}<button aria-label="Close product editor" className="shop-delete-button" disabled={action !== null} onClick={() => { if (canSwitchProduct()) closeProductEditor(); }} type="button"><X size={18} /></button></div></div>
    {deleteProductPending && <p className="shop-platform-note">This product will be deleted when you save. Revert restores it.</p>}
    <form className="shop-product-form" id="shop-product-form" onSubmit={(event) => { event.preventDefault(); void saveChanges(); }}><fieldset disabled={action !== null || deleteProductPending}>
      <div className="shop-kind-selector">
        <button className={draft.type === "digital" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, type: "digital" }))} type="button"><FileArchive size={18} /><span><strong>Digital file</strong><small>PDF, ZIP, image or video</small></span></button>
        <button className={draft.type === "service" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, type: "service" }))} type="button"><Euro size={18} /><span><strong>Service</strong><small>Consulting, session or booking</small></span></button>
      </div>
      <label><span>Name</span><input maxLength={90} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Brand kit" ref={productNameRef} required value={draft.title} /></label>
      <ShopDescriptionField label="Short description" maxLength={SHOP_SUMMARY_LIMIT} onChange={(summary) => setDraft((current) => ({ ...current, summary }))} required={false} value={draft.summary} />
      <ShopDescriptionField label="Full description" maxLength={SHOP_DESCRIPTION_LIMIT} onChange={(description) => setDraft((current) => ({ ...current, description }))} value={draft.description} />
      <label><span>Cover image <small>JPEG, PNG, AVIF, WebP or GIF · max 5 MB · automatically fitted without stretching or cropping</small></span><input accept="image/jpeg,image/png,image/avif,image/webp,image/gif" onChange={(event) => setCover(event.target.files?.[0] || null)} type="file" />{draftCoverUrl && <img alt="Cover preview" className="shop-cover-upload-preview" src={new URL(draftCoverUrl, data.shop?.publicUrl || "https://orbitpage.com").toString()} />}{draft.productId && data.products.find((product) => product.productId === draft.productId)?.coverUrl && !cover && <small>Current cover image saved</small>}</label>
      <label><span>Price</span><span className="shop-price-input"><Euro size={17} /><input inputMode="decimal" min="1" onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder="15.00" required step="0.01" type="number" value={draft.price} /></span></label>
      {draft.type === "digital" ? <div className="shop-product-files-field"><strong>Product files</strong><button className="button secondary compact" onClick={() => setFilesDialogOpen(true)} type="button"><FileArchive size={16} /> Manage files</button><small>Up to 10 files · max {maxFileLabel} each</small><ul>{savedProductFiles.map((item) => <li key={item.id}><FileArchive size={14} /><span>{item.filename}</span><small>{fileSize(item.sizeBytes)} · Saved</small><button aria-label={`Remove uploaded ${item.filename}`} className="shop-delete-button" disabled={action !== null} onClick={() => removeSavedFile(item.id)} type="button"><Trash2 size={16} /></button></li>)}{files.map((file, index) => <li key={index}><FileArchive size={14} /><span>{file.name}</span><small>{fileSize(file.size)} · Selected</small></li>)}</ul></div> : <>
        <label><span><span className="shop-label-with-icon"><CalendarDays size={16} /> Booking calendar</span></span><input maxLength={2048} onChange={(event) => setDraft((current) => ({ ...current, bookingUrl: event.target.value }))} placeholder="https://calendly.com/your-name/consulting" type="url" value={draft.bookingUrl} /><small>Calendly, Cal.com, Google Calendar or another secure HTTPS booking page. This link is revealed only after payment.</small></label>
        <label><span>Sessions included</span><input max="50" min="1" onChange={(event) => setDraft((current) => ({ ...current, sessionsIncluded: event.target.value }))} required type="number" value={draft.sessionsIncluded} /><small>Use more than one session to sell a consulting package.</small></label>
        <label><span>Pre-consultation questions</span><textarea maxLength={2400} onChange={(event) => setDraft((current) => ({ ...current, intakeQuestionsText: event.target.value }))} placeholder={"What would you like to achieve? *\nUseful links\nAnything we should know?"} rows={5} value={draft.intakeQuestionsText} /><small>One question per line, maximum 12. End a required question with *.</small></label>
        <label><span>Instructions after payment</span><textarea maxLength={2000} onChange={(event) => setDraft((current) => ({ ...current, fulfillmentText: event.target.value }))} placeholder="Add preparation notes, call details or what happens next." rows={4} value={draft.fulfillmentText} /><small>Add a calendar link, instructions, or both.</small></label>
      </>}
      <label className="shop-availability"><ToggleSwitch aria-label="Available for purchase" checked={draft.active} onCheckedChange={(active) => setDraft((current) => ({ ...current, active }))} /><span><strong>Available for purchase</strong><small>Only available products appear in the public shop.</small></span></label>
      <details className="shop-product-style">
        <summary><Palette size={17} /><span><strong>Card style</strong><small>Optional override for this product</small></span></summary>
        <div>
          <label><span>Surface</span><select onChange={(event) => setDraft((current) => ({ ...current, cardStyle: { ...current.cardStyle, surfaceEffect: event.target.value as ProductCardStyle["surfaceEffect"] } }))} value={draft.cardStyle.surfaceEffect}><option value="inherit">Use shop style</option><option value="solid">Solid</option><option value="transparent">Transparent</option><option value="liquid-glass">Liquid glass</option></select></label>
          <label><span>Alignment</span><select onChange={(event) => setDraft((current) => ({ ...current, cardStyle: { ...current.cardStyle, alignment: event.target.value as ProductCardStyle["alignment"] } }))} value={draft.cardStyle.alignment}><option value="inherit">Use shop alignment</option><option value="left">Left</option><option value="center">Center</option></select></label>
          <div className="shop-product-colors">
            <ShopColorField disabled={draft.cardStyle.surfaceEffect === "inherit"} label="Background" onChange={(value) => setDraft((current) => ({ ...current, cardStyle: { ...current.cardStyle, backgroundColor: value } }))} value={draft.cardStyle.backgroundColor || appearance?.cardBackground || "#ffffff"} />
            <ShopColorField disabled={draft.cardStyle.surfaceEffect === "inherit"} label="Text" onChange={(value) => setDraft((current) => ({ ...current, cardStyle: { ...current.cardStyle, textColor: value } }))} value={draft.cardStyle.textColor || appearance?.cardTextColor || "#0c1528"} />
          </div>
          <button className="button secondary compact" onClick={() => setDraft((current) => ({ ...current, cardStyle: EMPTY_PRODUCT.cardStyle }))} type="button">Use shop defaults</button>
        </div>
      </details>

    </fieldset></form>
  </> : null;
  const editingStorefront = view === "products" || view === "design";
  function revertChanges() {
    setSmtpDraft(data?.shop?.emailSettings ? emailDraft(data.shop.emailSettings) : null);
    setAppearance(data?.shop?.appearance || null); setLogoFile(null); setDeleteProfilePending(false); setDeleteProductPending(false);
    setPolicyDrafts({});
    setFiles([]); setCover(null); setUploadProgress([]); setFeedback(null);
    if (originalProduct) setDraft(productDraft(originalProduct)); else closeProductEditor();
  }
  async function saveChanges() {
    if (action !== null || !changed) return;
    const forms = [
      productChanged && !deleteProductPending ? "shop-product-form" : "",
      appearanceChanged ? settingsTab === "checkout" ? "shop-checkout-settings" : "shop-legal-profile" : "",
      emailChanged ? "shop-email-settings" : "",
    ];
    for (const id of forms) {
      const form = id ? document.getElementById(id) as HTMLFormElement | null : null;
      if (form && !form.reportValidity()) return;
    }
    if (emailChanged && !await saveEmail()) return;
    if (appearanceChanged && !await saveAppearance(undefined, view === "settings" && settingsTab === "compliance")) return;
    if (productChanged) {
      if (deleteProductPending && originalProduct) await deleteProduct(originalProduct); else await saveProduct();
    }
  }
  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    const savedCount = savedProductFiles.length;
    const next = [...files];
    for (const file of Array.from(selected)) if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    if (next.length + savedCount > 10 || next.some((file) => !file.size || file.size > data!.limits.maxFileBytes)) { setFeedback({ type: "error", text: `Choose up to ${10 - savedCount} files, each no larger than ${maxFileLabel}.` }); return; }
    setFiles(next); setUploadProgress([]); setFeedback(null);
  }
  function updateCheckout(patch: Partial<ShopAppearance["checkout"]>) {
    setAppearance(current => current ? { ...current, checkout: { ...current.checkout, ...patch } } : current);
  }
  function removeSavedFile(fileId: string) {
    if (action !== null) return;
    setDraft(current => ({ ...current, removedFileIds: [...current.removedFileIds, fileId], active: current.active && (savedProductFiles.length > 1 || files.length > 0) }));
    setUploadProgress([]); setFeedback(null);
  }
  const catalogProducts = data.products.filter((product) =>
    (catalogFilter === "all" || (catalogFilter === "hidden" ? !product.active : product.active)) &&
    (catalogType === "all" || product.type === catalogType) &&
    (!catalogMinPrice || product.priceCents >= Number(catalogMinPrice) * 100) &&
    (!catalogMaxPrice || product.priceCents <= Number(catalogMaxPrice) * 100) &&
    `${product.title} ${product.summary || product.description}`.toLowerCase().includes(catalogQuery.trim().toLowerCase())
  ).sort((a, b) => catalogSort === "price-asc" ? a.priceCents - b.priceCents : catalogSort === "price-desc" ? b.priceCents - a.priceCents : catalogSort === "title-desc" ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
  const orderRows = data.orders.filter(order =>
    `${order.orderId} ${order.productTitle} ${order.buyerEmail || ""} ${order.buyerName || ""}`.toLowerCase().includes(orderFilters.query.trim().toLowerCase()) &&
    (!orderFilters.customer || order.buyerEmail?.toLowerCase() === orderFilters.customer.toLowerCase()) &&
    (orderFilters.status === "all" || order.status === orderFilters.status) &&
    (orderFilters.type === "all" || order.productType === orderFilters.type) &&
    inShopDateRange(order.paidAt || order.createdAt, orderFilters.from, orderFilters.to)
  ).sort((a, b) => {
    const value = (order: ShopOrder) => orderSort.column === "total" ? order.amountTotal : orderSort.column === "order" ? order.orderId : orderSort.column === "product" ? order.productTitle : orderSort.column === "customer" ? order.buyerEmail || "" : orderSort.column === "payment" ? order.status : order.paidAt || order.createdAt;
    const left = value(a), right = value(b);
    return (orderSort.descending ? -1 : 1) * (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) || a.orderId.localeCompare(b.orderId);
  });
  const customerRows = data.customers.filter(customer =>
    `${customer.email} ${customer.customerId} ${customer.name || ""}`.toLowerCase().includes(customerFilters.query.trim().toLowerCase()) &&
    (customerFilters.purchases === "all" || (customerFilters.purchases === "repeat" ? customer.orderCount > 1 : customer.orderCount === 1)) &&
    inShopDateRange(customer.lastPurchaseAt, customerFilters.from, customerFilters.to)
  ).sort((a, b) => {
    const value = (customer: ShopDashboard["customers"][number]) => customerSort.column === "purchases" ? customer.orderCount : customerSort.column === "email" ? customer.email : customer.lastPurchaseAt;
    const left = value(a), right = value(b);
    return (customerSort.descending ? -1 : 1) * (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) || a.customerId.localeCompare(b.customerId);
  });
  const sortOrders = (column: string) => setOrderSort(current => ({ column, descending: current.column === column ? !current.descending : false }));
  const sortCustomers = (column: string) => setCustomerSort(current => ({ column, descending: current.column === column ? !current.descending : false }));
  const resetOrderFilters = () => { setOrderFilters(EMPTY_ORDER_FILTERS); setOrderSort({ column: "date", descending: true }); };
  const resetCustomerFilters = () => { setCustomerFilters(EMPTY_CUSTOMER_FILTERS); setCustomerSort({ column: "date", descending: true }); };
  const customizationPanel = appearance && <form className="panel shop-customization" onSubmit={(event) => { event.preventDefault(); void saveChanges(); }}><fieldset disabled={action !== null}>
    <section className="shop-design-panel">
      <div className="shop-section-heading"><div><h3>Personalize</h3></div><button aria-label="Close personalization" className="shop-delete-button" disabled={action !== null} onClick={() => setView("products")} type="button"><X size={18} /></button></div>

      <label className="shop-setting-toggle">
        <ToggleSwitch aria-label="Use the page theme" checked={appearance.inheritPageTheme} onCheckedChange={(inheritPageTheme) => setAppearance((current) => current ? { ...current, inheritPageTheme } : current)} />
        <span><strong>Use the page theme</strong><small>Keep colors and typography consistent with your main OrbitPage.</small></span>
      </label>
      <fieldset aria-label="Shop customization options" className="shop-customization-options" disabled={appearance.inheritPageTheme}>
      <nav aria-label="Theme options" className="shop-settings-tabs"><button aria-current={themeMode === "presets" ? "page" : undefined} onClick={() => setThemeMode("presets")} type="button">Themes</button><button aria-current={themeMode === "custom" ? "page" : undefined} onClick={() => setThemeMode("custom")} type="button">Custom theme</button></nav>
      {themeMode === "presets" ? <div className="shop-theme-presets">{SHOP_THEMES.map(({ name, ...colors }) => <button aria-label={`${name} theme`} key={name} onClick={() => setAppearance((current) => current ? { ...current, ...colors, inheritPageTheme: false } : current)} type="button"><span style={{ background: colors.pageBackground, color: colors.textColor }}><i style={{ background: colors.cardBackground, borderColor: colors.borderColor }} /><i style={{ background: colors.accentColor }} /></span><strong>{name}</strong></button>)}</div> : <>
      <div className="shop-color-grid">
        <ShopColorField disabled={appearance.inheritPageTheme} label="Background" onChange={(value) => setAppearance((current) => current ? { ...current, pageBackground: value } : current)} value={appearance.pageBackground} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Page text" onChange={(value) => setAppearance((current) => current ? { ...current, textColor: value } : current)} value={appearance.textColor} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Secondary text" onChange={(value) => setAppearance((current) => current ? { ...current, mutedColor: value } : current)} value={appearance.mutedColor} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Accent" onChange={(value) => setAppearance((current) => current ? { ...current, accentColor: value } : current)} value={appearance.accentColor} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Button text" onChange={(value) => setAppearance((current) => current ? { ...current, buttonTextColor: value } : current)} value={appearance.buttonTextColor} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Card" onChange={(value) => setAppearance((current) => current ? { ...current, cardBackground: value } : current)} value={appearance.cardBackground} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Card text" onChange={(value) => setAppearance((current) => current ? { ...current, cardTextColor: value } : current)} value={appearance.cardTextColor} />
        <ShopColorField disabled={appearance.inheritPageTheme} label="Border" onChange={(value) => setAppearance((current) => current ? { ...current, borderColor: value } : current)} value={appearance.borderColor} />
      </div>

      <div className="shop-design-section">
        <div><strong>Product cards</strong><small>Control the shared look. Individual products can override it.</small></div>
        <div className="shop-option-grid">
          <label><span>Surface</span><select onChange={(event) => setAppearance((current) => current ? { ...current, cardEffect: event.target.value as ShopAppearance["cardEffect"] } : current)} value={appearance.cardEffect}><option value="solid">Solid</option><option value="transparent">Transparent</option><option value="liquid-glass">Liquid glass</option></select></label>
          <label><span>Layout</span><select onChange={(event) => setAppearance((current) => current ? { ...current, layout: event.target.value as ShopAppearance["layout"] } : current)} value={appearance.layout}><option value="grid">Grid</option><option value="list">List</option></select></label>
          <label><span>Alignment</span><select onChange={(event) => setAppearance((current) => current ? { ...current, alignment: event.target.value as ShopAppearance["alignment"] } : current)} value={appearance.alignment}><option value="left">Left</option><option value="center">Center</option></select></label>
        </div>
        <label className="shop-range-field"><span>Card opacity <b>{Math.round(appearance.cardOpacity * 100)}%</b></span><RangeSlider aria-label="Card opacity" max={1} min={0} onChange={(event) => setAppearance((current) => current ? { ...current, cardOpacity: Number(event.target.value) } : current)} step=".05" value={appearance.cardOpacity} valueLabel={`${Math.round(appearance.cardOpacity * 100)}%`} /></label>
        <label className="shop-range-field"><span>Corner radius <b>{appearance.cardRadius}px</b></span><RangeSlider aria-label="Corner radius" disabled={appearance.inheritPageTheme} max={32} min={0} onChange={(event) => setAppearance((current) => current ? { ...current, cardRadius: Number(event.target.value) } : current)} value={appearance.cardRadius} valueLabel={`${appearance.cardRadius}px`} /></label>
        <label className="shop-range-field"><span>Shadow <b>{appearance.shadowIntensity}%</b></span><RangeSlider aria-label="Shadow" max={100} min={0} onChange={(event) => setAppearance((current) => current ? { ...current, shadowIntensity: Number(event.target.value) } : current)} value={appearance.shadowIntensity} valueLabel={`${appearance.shadowIntensity}%`} /></label>
        <label className="shop-setting-toggle compact"><ToggleSwitch aria-label="Show product type" checked={appearance.showProductType} onCheckedChange={(showProductType) => setAppearance((current) => current ? { ...current, showProductType } : current)} size="small" /><span><strong>Show product type</strong><small>Display “digital download” or “service” above each item.</small></span></label>
      </div></>}

      <div className="shop-design-section shop-home-link-section">
        <div className="shop-home-link-heading"><div><strong>Add Shop to Home</strong><small>Create a normal OrbitPage card that opens this shop.</small></div><Link2 size={20} /></div>
        <label className="shop-setting-toggle compact"><ToggleSwitch aria-label="Show a Shop card on Home" checked={appearance.homeLinkEnabled} onCheckedChange={(homeLinkEnabled) => setAppearance((current) => current ? { ...current, homeLinkEnabled } : current)} size="small" /><span><strong>Show a Shop card on Home</strong><small>The card is added when the shop is online and removed when it is unpublished.</small></span></label>
        {appearance.homeLinkEnabled && <div className="shop-home-link-fields"><label><span>Card title</span><input maxLength={70} onChange={(event) => setAppearance((current) => current ? { ...current, homeLinkTitle: event.target.value } : current)} required value={appearance.homeLinkTitle} /></label><label><span>Description</span><input maxLength={180} onChange={(event) => setAppearance((current) => current ? { ...current, homeLinkDescription: event.target.value } : current)} value={appearance.homeLinkDescription} /></label></div>}
      </div>
      <div className="shop-design-section shop-home-link-section">
        <div className="shop-home-link-heading"><div><strong>Newsletter signup</strong><small>Collect subscribers from the public Shop.</small></div><MailPlus size={20} /></div>
        <label className="shop-setting-toggle compact"><ToggleSwitch aria-label="Show newsletter signup form" checked={appearance.newsletterEnabled} disabled={!data.newsletterComplianceReady} onCheckedChange={(newsletterEnabled) => setAppearance((current) => current ? { ...current, newsletterEnabled } : current)} size="small" /><span><strong>Show signup form</strong><small>{data.newsletterComplianceReady ? "Subscribers join the same audience used by Newsletter." : "Complete Newsletter compliance settings first."}</small></span></label>
      </div>
      </fieldset>
    </section>

  </fieldset></form>;
  return (
    <section className={embedded ? "shop-workspace embedded" : "shop-workspace"} lang="en-US" dir="ltr">
      {!embedded && <header className="shop-command-bar">
        <div className="shop-command-copy">
          {!embedded && <button className="shop-back-button" onClick={onBackToContent} type="button"><ChevronLeft size={16} /> Content</button>}
          <div className="shop-command-title"><ShoppingBag size={18} /><strong>Shop</strong>{paymentMode}</div>
          <p>Sell downloads and services. Stripe verifies the seller, processes payments and pays out directly.</p>
        </div>
        {shopActions}
      </header>}

      {feedback && <p className={`shop-feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.type === "success" && <CheckCircle2 size={17} />}{feedback.text}</p>}
      {feedback?.code === "CONNECT_PLATFORM_ACTIVATION_REQUIRED" && (
        <p className="shop-platform-note">You can continue preparing products. Connecting payouts will become available as soon as OrbitPage completes Stripe platform activation.</p>
      )}
      <div className="shop-view-toolbar">
        <div className="shop-toolbar-left">
          <button aria-label="Shop settings" aria-pressed={view === "settings"} className="shop-tool-button" disabled={action !== null} onClick={() => setView("settings")} title="Settings" type="button"><Settings size={18} /></button>
          <button aria-label="Orders and customers" aria-pressed={view === "orders" || view === "customers"} className="shop-tool-button" disabled={action !== null} onClick={() => setView("orders")} title="Orders and customers" type="button"><ReceiptText size={18} /></button>
          {editingStorefront && <button aria-label="Personalize" aria-expanded={view === "design"} aria-pressed={view === "design"} aria-controls="shop-personalization" className="shop-tool-button shop-personalize-button" disabled={action !== null} onClick={() => setView(view === "design" ? "products" : "design")} title="Personalize" type="button"><Palette size={18} /><span>Personalize</span></button>}
        </div>
        <div className="shop-toolbar-publication">
          {!editingStorefront && <button className="button secondary" disabled={action !== null} onClick={() => setView("products")} type="button"><ChevronLeft size={16} /> Back to shop</button>}
          {publicationButton}
        </div>
        <div className="shop-toolbar-right">{editingStorefront && data.products.length > 0 && <button aria-label="View catalog" className="button secondary compact shop-catalog-button" onClick={() => setCatalogOpen(true)} title="View catalog" type="button"><Search size={14} /><span>View catalog</span></button>}{editingStorefront && addProductButton}</div>
      </div>

      {editingStorefront && appearance && previewDesign && <div className={"shop-storefront-workspace" + (view === "design" || productEditorOpen ? " has-inspector" : "")}>
        <section aria-label="Shop preview" className="shop-storefront-canvas">
          <div className="shop-preview-controls"><span title={previewInstructions}>{previewInstructions}</span><div aria-label="Preview device" className="shop-device-toggle" role="group"><button aria-label="Mobile preview" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title="Mobile preview" type="button"><Smartphone size={17} /></button><button aria-label="Desktop preview" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="Desktop preview" type="button"><Monitor size={17} /></button></div></div>
          <ShopStorefrontPreview appearance={{ ...appearance, logoUrl: logoPreviewUrl || appearance.logoUrl }} canAddProduct={data.products.length < data.limits.maxProducts} copy={previewCopy} design={previewDesign} device={device} disabled={action !== null} onAddProduct={openNewProduct} onEditLogo={() => setLogoDialogOpen(true)} onEditBackLink={() => { setBackLinkDraft(appearance.backLinkLabel || previewCopy.back); setBackLinkDialogOpen(true); }} onEditIdentity={() => setIdentityDialogOpen(true)} onSelectProduct={selectProduct} products={previewProducts} publicUrl={data.shop?.publicUrl || window.location.origin} selectedProductId={productEditorOpen ? draft.productId || "draft-product" : undefined} surface={previewSurface} />

        </section>
        {view === "design" ? <aside aria-label="Personalization" id="shop-personalization">{customizationPanel}</aside> : productEditorOpen && <aside aria-label="Product editor" className="panel shop-catalog-panel is-editing" id="shop-catalog">{productEditor}</aside>}
      </div>}

      {view === "settings" && <nav aria-label="Shop settings sections" className="shop-settings-tabs"><button aria-current={settingsTab === "compliance" ? "page" : undefined} onClick={() => setSettingsTab("compliance")} type="button"><ShieldCheck size={15} /> Compliance</button><button aria-current={settingsTab === "checkout" ? "page" : undefined} onClick={() => setSettingsTab("checkout")} type="button"><ShoppingCart size={15} /> Checkout</button><button aria-current={settingsTab === "stripe" ? "page" : undefined} onClick={() => setSettingsTab("stripe")} type="button"><CreditCard size={15} /> Stripe</button><button aria-current={settingsTab === "email" ? "page" : undefined} onClick={() => setSettingsTab("email")} type="button"><Mail size={15} /> Email</button><button aria-current={settingsTab === "calendar" ? "page" : undefined} onClick={() => setSettingsTab("calendar")} type="button"><CalendarDays size={15} /> Calendar</button></nav>}
      {(view === "orders" || view === "customers") && <nav aria-label="Sales" className="shop-sales-tabs"><button aria-current={view === "orders" ? "page" : undefined} onClick={() => setView("orders")} type="button"><ReceiptText size={16} /> Orders</button><button aria-current={view === "customers" ? "page" : undefined} onClick={() => setView("customers")} type="button">Customers</button></nav>}

      {view === "settings" && settingsTab === "compliance" && appearance && <form aria-labelledby="shop-legal-profile-title" className="shop-provider-panel shop-provider-form shop-legal-settings" id="shop-legal-profile" onSubmit={(event) => { event.preventDefault(); void saveChanges(); }}>
            <header className="shop-provider-heading">
              <h3 id="shop-legal-profile-title">Seller and legal information</h3>
              {data.shop?.appearance.sellerName && <button aria-label="Delete seller profile" className="shop-delete-button" disabled={action !== null || deleteProfilePending} onClick={() => { setAppearance(clearLegalProfile(appearance)); setPolicyDrafts({}); setDeleteProfilePending(true); }} type="button"><Trash2 size={16} /></button>}
              <div className="shop-legal-intro">
                <p>Add your seller details and Shop policies. You can save an incomplete profile and finish it later.</p>
                {!sellerAcknowledged && <p>To publish, confirm your responsibility as the seller using the checkbox below.</p>}
                {sellerDetailsIncomplete && <p>Some details or policies are missing. Publication is still allowed after confirmation; you must provide any information required by law.</p>}
              </div>
            </header>
            <fieldset disabled={action !== null}>
            <div className="shop-legal-fields">
              <div className="shop-seller-fields">
              <div className="shop-option-grid">
                <label><span>Seller status</span><select onChange={(event) => setAppearance((current) => current ? { ...current, sellerType: event.target.value as ShopAppearance["sellerType"] } : current)} value={appearance.sellerType}><option value="unset">Not specified</option><option value="trader">Professional / trader</option><option value="private">Private seller</option></select></label>
                <label><span>Public seller name</span><input maxLength={120} onChange={(event) => setAppearance((current) => current ? { ...current, sellerName: event.target.value } : current)} value={appearance.sellerName} /></label>
                <label><span>Public email</span><input autoComplete="email" maxLength={254} onChange={(event) => setAppearance((current) => current ? { ...current, sellerEmail: event.target.value } : current)} type="email" value={appearance.sellerEmail} /></label>
                <label><span>Public phone <small>Optional</small></span><input autoComplete="tel" maxLength={30} onChange={(event) => setAppearance((current) => current ? { ...current, sellerPhone: event.target.value } : current)} type="tel" value={appearance.sellerPhone} /></label>
              </div>
              <label className="shop-seller-address"><span>Geographic address <small>Provide where required by law</small></span><textarea maxLength={300} onChange={(event) => setAppearance((current) => current ? { ...current, sellerAddress: event.target.value } : current)} rows={3} value={appearance.sellerAddress} /></label>
              </div>
              {appearance.sellerType === "trader" && <label><span>VAT, tax or business registration ID <small>When applicable</small></span><input maxLength={120} onChange={(event) => setAppearance((current) => current ? { ...current, sellerBusinessId: event.target.value } : current)} value={appearance.sellerBusinessId} /></label>}
              <p className="shop-platform-note">Hosted policies appear as sections on /shop/legal. Footer links are always visible; unconfigured policies return 404.</p>
              <div className="shop-legal-policies">
                {SHOP_POLICIES.map((policy) => {
                  const source = policyDrafts[policy.slug]?.source || (appearance[policy.textField] || !appearance[policy.urlField] ? "hosted" : "external");
                  return <article aria-label={policy.title} key={policy.slug}>
                    <strong>{policy.title}</strong>
                    <div aria-label={`${policy.title} source`} className="shop-kind-selector" role="group">
                      <button aria-pressed={source === "hosted"} className={source === "hosted" ? "active" : undefined} onClick={() => updatePolicy(policy, "hosted")} type="button"><ShieldCheck size={18} /><span><strong>Host in OrbitPage</strong><small>Write or paste the policy text.</small></span></button>
                      <button aria-pressed={source === "external"} className={source === "external" ? "active" : undefined} onClick={() => updatePolicy(policy, "external")} type="button"><Link2 size={18} /><span><strong>External</strong><small>Link to a policy on your website.</small></span></button>
                    </div>
                    {source === "hosted"
                      ? <label><span>Text hosted in this Shop</span><textarea maxLength={6000} onChange={(event) => updatePolicy(policy, "hosted", event.target.value)} rows={5} value={appearance[policy.textField]} /></label>
                      : <label><span>External HTTPS URL</span><input maxLength={2048} onChange={(event) => updatePolicy(policy, "external", event.target.value)} placeholder="https://" type="url" value={appearance[policy.urlField]} /></label>}
                  </article>;
                })}
              </div>
              <label className="shop-setting-toggle compact"><input checked={appearance.sellerSelfCertified} onChange={(event) => setAppearance((current) => current ? { ...current, sellerSelfCertified: event.target.checked } : current)} type="checkbox" /><span><strong>I acknowledge my responsibility as the seller</strong><small>I am responsible for providing legally required seller and customer information, accurate product details, applicable policies, taxes, refunds and lawful products or services. OrbitPage provides the Shop software; this acknowledgment does not waive customer rights or OrbitPage's own legal obligations.</small></span></label>
            </div>
            </fieldset></form>}

      {view === "settings" && settingsTab === "checkout" && appearance && <form aria-labelledby="shop-checkout-title" className="shop-provider-panel shop-provider-form shop-checkout-settings" id="shop-checkout-settings" onSubmit={event => { event.preventDefault(); void saveChanges(); }}>
        <header className="shop-provider-heading">
          <h3 id="shop-checkout-title">Customer details</h3>
          <p>Choose the information requested at checkout. Name and email are always required.</p>
          <a className="shop-provider-docs" href={documentationUrl("customer-details")} rel="noreferrer" target="_blank"><HelpCircle aria-hidden="true" size={14} /> Checkout documentation</a>
        </header>
        <fieldset disabled={action !== null}>
          <div className="shop-option-grid">
            <label>Name<select disabled value="required"><option value="required">Always required</option></select></label>
            <label>Email<select disabled value="required"><option value="required">Always required</option></select></label>
            <label>Phone number<select onChange={event => updateCheckout({ phone: event.target.value === "required" })} value={appearance.checkout.phone ? "required" : "off"}><option value="off">Not collected</option><option value="required">Required</option></select><small>Stripe requires a phone number when enabled.</small></label>
            <label>Billing address<select onChange={event => updateCheckout({ billingAddress: event.target.value as ShopAppearance["checkout"]["billingAddress"] })} value={appearance.checkout.billingAddress}><option value="auto">Only when Stripe needs it</option><option value="required">Always required</option></select><small>Payment methods can require billing information.</small></label>
            <label>Business name<select onChange={event => updateCheckout({ businessName: event.target.value as ShopAppearance["checkout"]["businessName"] })} value={appearance.checkout.businessName}><option value="off">Not collected</option><option value="optional">Optional</option><option value="required">Required</option></select><small>Stripe may also request a business name with tax IDs.</small></label>
            <label>Tax ID / VAT number<select onChange={event => updateCheckout({ taxId: event.target.value as ShopAppearance["checkout"]["taxId"] })} value={appearance.checkout.taxId}><option value="off">Not collected</option><option value="optional">Optional</option><option value="if_supported">Required where supported by Stripe</option></select><small>Collection follows Stripe's supported billing countries.</small></label>
          </div>
          <div className="shop-section-heading"><h3>Additional fields</h3><span>{appearance.checkout.customFields.length} / 3</span></div>
          <p className="shop-provider-muted">Add text or numbers needed for the order, such as a project or purchase reference. Stripe allows up to three custom fields; do not use them for sensitive or protected information.</p>
          {appearance.checkout.customFields.map((field, index) => <div className="shop-option-grid shop-checkout-custom-field" key={field.key}>
            <label>Field {index + 1} label<input maxLength={50} onChange={event => updateCheckout({ customFields: appearance.checkout.customFields.map(item => item.key === field.key ? { ...item, label: event.target.value } : item) })} placeholder="e.g. Project reference" required value={field.label} /></label>
            <label>Field {index + 1} type<select onChange={event => updateCheckout({ customFields: appearance.checkout.customFields.map(item => item.key === field.key ? { ...item, type: event.target.value as "text" | "numeric" } : item) })} value={field.type}><option value="text">Text</option><option value="numeric">Numbers only</option></select></label>
            <label>Field {index + 1} requirement<select onChange={event => updateCheckout({ customFields: appearance.checkout.customFields.map(item => item.key === field.key ? { ...item, required: event.target.value === "required" } : item) })} value={field.required ? "required" : "optional"}><option value="optional">Optional</option><option value="required">Required</option></select></label>
            <button aria-label={`Remove field ${index + 1}`} className="shop-delete-button" onClick={() => updateCheckout({ customFields: appearance.checkout.customFields.filter(item => item.key !== field.key) })} type="button"><Trash2 size={17} /></button>
          </div>)}
          <button className="button secondary shop-checkout-add" disabled={appearance.checkout.customFields.length >= 3} onClick={() => updateCheckout({ customFields: [...appearance.checkout.customFields, { key: crypto.randomUUID().replaceAll("-", ""), label: "", type: "text", required: false }] })} type="button"><PackagePlus size={16} /> Add field</button>
          <p className="shop-provider-muted">Save to apply these settings to new checkouts. Existing orders keep the information collected at purchase.</p>
        </fieldset>
      </form>}

      {view === "settings" && settingsTab === "email" && smtpDraft && <form aria-labelledby="shop-email-title" className="shop-provider-panel shop-provider-form" id="shop-email-settings" onSubmit={event => { event.preventDefault(); void saveChanges(); }}>
        <header className="shop-provider-heading">
          <h3 id="shop-email-title">Email</h3>
          <span className="shop-provider-status">{smtpDraft.mode === "platform" ? "OrbitPage" : "Custom SMTP"}</span>
          <p>Choose the sender for order confirmations and booking emails. Newsletter has its own settings.</p>
          <a className="shop-provider-docs" href={documentationUrl("email")} rel="noreferrer" target="_blank"><HelpCircle aria-hidden="true" size={14} /> Shop email documentation</a>
        </header>
        <fieldset disabled={action !== null}>
          <div className="shop-option-grid"><label>Email service<select disabled={selfHosted} onChange={event => setSmtpDraft(current => current ? { ...current, mode: event.target.value as ShopEmailDraft["mode"] } : current)} value={smtpDraft.mode}>{!selfHosted && <option value="platform">Use OrbitPage email</option>}<option value="custom">Use custom SMTP</option></select></label></div>
          {smtpDraft.mode === "platform" ? <p className="shop-provider-muted">{data.shop?.emailSettings?.mode === "platform" ? data.shop.emailSettings.configured ? "Shop emails use the OrbitPage email service." : "OrbitPage email is currently unavailable. You can configure your own SMTP server." : "Save to switch Shop email delivery back to OrbitPage."}</p> : <>
            <div className="shop-option-grid">
              <label>SMTP host<input autoCapitalize="none" autoComplete="off" maxLength={253} onChange={event => setSmtpDraft(current => current ? { ...current, host: event.target.value } : current)} placeholder="smtp.example.com" required spellCheck={false} value={smtpDraft.host} /></label>
              <label>SMTP port<select onChange={event => setSmtpDraft(current => current ? { ...current, port: Number(event.target.value) as ShopEmailDraft["port"] } : current)} value={smtpDraft.port}><option value={465}>465 · TLS</option><option value={587}>587 · STARTTLS</option><option value={2525}>2525 · STARTTLS</option></select></label>
              <label>SMTP username<input autoCapitalize="none" autoComplete="off" maxLength={320} onChange={event => setSmtpDraft(current => current ? { ...current, username: event.target.value } : current)} required spellCheck={false} value={smtpDraft.username} /></label>
              <label>SMTP password<input autoComplete="new-password" maxLength={1024} onChange={event => setSmtpDraft(current => current ? { ...current, password: event.target.value } : current)} placeholder={data.shop?.emailSettings?.passwordConfigured ? "Saved password · leave blank to keep" : "SMTP password or app password"} required={!data.shop?.emailSettings?.passwordConfigured || smtpDraft.host !== data.shop.emailSettings.host || smtpDraft.username !== data.shop.emailSettings.username} type="password" value={smtpDraft.password} /></label>
              <label>Sender name<input maxLength={100} onChange={event => setSmtpDraft(current => current ? { ...current, fromName: event.target.value } : current)} required value={smtpDraft.fromName} /></label>
              <label>Sender email<input autoCapitalize="none" maxLength={254} onChange={event => setSmtpDraft(current => current ? { ...current, fromEmail: event.target.value } : current)} placeholder="orders@example.com" required type="email" value={smtpDraft.fromEmail} /></label>
              <label>Reply-to email (optional)<input autoCapitalize="none" maxLength={254} onChange={event => setSmtpDraft(current => current ? { ...current, replyTo: event.target.value } : current)} type="email" value={smtpDraft.replyTo} /></label>
            </div>
            <p className="shop-provider-muted">Use a sender address allowed by your SMTP provider. TLS is required. Save changes before testing.</p>
            <div className="shop-connect-actions"><button className="button secondary compact" disabled={emailChanged || data.shop?.emailSettings?.mode !== "custom" || !data.shop.emailSettings.passwordConfigured} onClick={() => void testEmail()} type="button">{action === "test-email" ? <LoadingIndicator size={15} /> : <Mail size={15} />} Send test email</button><span className="shop-provider-muted">{emailChanged ? "Unsaved settings" : data.shop?.emailSettings?.verifiedAt ? "Test sent successfully" : "Not tested yet"}</span></div>
            <p className="shop-provider-muted">The test is sent to your account email. Customer replies go to the seller, and seller notifications reply to the customer.</p>
          </>}
        </fieldset>
      </form>}

      {view === "settings" && (settingsTab === "stripe" || settingsTab === "calendar") && (
        <section className="shop-payments-view">
          {settingsTab === "stripe" && <section aria-labelledby="shop-stripe-title" className="shop-provider-panel">
            <header className="shop-provider-heading">
              <h3 id="shop-stripe-title" aria-live="polite">{stripeCheckFailed ? "Stripe status could not be verified" : shopReady ? <>Stripe payments are {data.shop?.stripeLivemode === false ? <>in Test mode <span className="shop-stripe-ready shop-stripe-ready-note">ready and configured</span></> : <span className="shop-stripe-ready">ready and configured</span>}</> : selfHosted ? "Configure your Stripe account" : data.shop?.stripeConnected ? "Finish your Stripe setup" : "Connect Stripe to start selling"}</h3>
              {(stripeCheckFailed || !shopReady) && <p>{stripeCheckFailed ? "Check your connection. Stripe status will be checked again automatically." : selfHosted ? "Use Test Mode to verify checkout before enabling live payments." : "Stripe collects your business, identity and bank details on its secure site."}</p>}
              <a className="shop-provider-docs" href={documentationUrl("connect")} rel="noreferrer" target="_blank"><HelpCircle aria-hidden="true" size={14} /> Shop and Stripe documentation</a>
            </header>
            <div className="shop-connect-actions">
              {data.shop?.stripeConnected && <a className="button secondary" href={stripeDashboardUrl} rel="noreferrer" target="_blank"><ArrowUpRight size={16} /> Stripe Dashboard</a>}
              {data.shop?.stripeConnected && !shopReady && <button className="button secondary" disabled={action !== null} onClick={() => void refreshStripeConnection()} type="button">{action === "refresh-status" ? <LoadingIndicator size={16} /> : <RefreshCw size={16} />} Check status</button>}
              {!selfHosted && <button className="button primary" disabled={action !== null || data.mode !== "stripe"} onClick={() => void connectStripe()} type="button">{action === "connect" ? <LoadingIndicator size={16} /> : <ArrowUpRight size={16} />}{data.shop?.stripeConnected ? "Update Stripe details" : "Connect Stripe"}</button>}
            </div>
            {selfHosted && <OwnerStripeSettings onSaved={next => { setStripeCheckFailed(false); setData(next); }} request={request} saved={data.shop?.stripeSettings} />}
            {data.mode !== "stripe" && <p className="shop-feedback error">Shop is not configured on this OrbitPage deployment yet.</p>}
            <div className="shop-payment-notes">
              <div><Euro size={20} /><span><strong>{selfHosted ? "No OrbitPage fee" : `${data.limits.feePercent}% OrbitPage fee`}</strong><small>{selfHosted ? "Stripe’s own fees apply to your account." : "Applied only to successful sales and returned proportionally on refunds."}</small></span></div>
              <div><ShieldCheck size={20} /><span><strong>Stripe-hosted verification</strong><small>Identity and bank details stay on Stripe. OrbitPage never stores your payout credentials.</small></span></div>
              <div><ReceiptText size={20} /><span><strong>Coupons enabled</strong><small>Create promotion codes in Stripe Dashboard. Customers can enter them during Checkout.</small></span></div>
            </div>
          </section>}
          {settingsTab === "calendar" && <section aria-labelledby="shop-calendar-title" className="shop-provider-panel">
            <header className="shop-provider-heading">
              <h3 id="shop-calendar-title">Calendar</h3>
              <p>Sell sessions with a booking link; optionally sync Cal.com booking changes.</p>
              <a className="shop-provider-docs" href={documentationUrl("calendar")} rel="noreferrer" target="_blank"><HelpCircle aria-hidden="true" size={14} /> Calendar documentation</a>
            </header>
            {calCom ? <div className="shop-calendar-integration">
              <div><div className="shop-calendar-heading"><strong>Cal.com webhook settings</strong><a className="button secondary compact" href="https://app.cal.com/settings/developer/webhooks" rel="noreferrer" target="_blank"><ArrowUpRight size={13} /> Open Cal.com webhooks</a></div><p>Add one webhook in Cal.com using these private values. No Cal.com API key is required.</p></div>
              <div className="shop-calendar-field"><label htmlFor="shop-calendar-webhook-url">Subscriber URL</label><div><input id="shop-calendar-webhook-url" onFocus={(event) => event.currentTarget.select()} readOnly value={calCom.webhookUrl} /><button className="button secondary compact" onClick={() => void copyCalendarValue("url", calCom.webhookUrl)} type="button">{copiedCalendarField === "url" ? <CheckCircle2 size={15} /> : <Copy size={15} />}{copiedCalendarField === "url" ? "Copied" : "Copy URL"}</button></div></div>
              <div className="shop-calendar-field"><label htmlFor="shop-calendar-signing-secret">Signing secret</label><div><input id="shop-calendar-signing-secret" onFocus={(event) => event.currentTarget.select()} readOnly type="password" value={calCom.signingSecret} /><button className="button secondary compact" onClick={() => void copyCalendarValue("secret", calCom.signingSecret)} type="button">{copiedCalendarField === "secret" ? <CheckCircle2 size={15} /> : <Copy size={15} />}{copiedCalendarField === "secret" ? "Copied" : "Copy secret"}</button></div></div>
              <div className="shop-calendar-events"><strong>Event triggers</strong><ul>{calCom.events.map((event) => <li key={event}><code>{event}</code></li>)}</ul></div>
              {calendarCopyError && <small role="alert">{calendarCopyError}</small>}
              <small>Keep the signing secret private. Booking status changes appear in Orders only after Cal.com sends a matching signed event.</small>
            </div> : <p className="shop-provider-muted">Cal.com webhook settings are available to Shop editors when Stripe mode is enabled.</p>}
          </section>}
        </section>
      )}


      {view === "orders" && <section className="panel shop-orders-panel">
        <div className="shop-section-heading"><div><h3>Recent sales <ShopHelp label="About recent sales" text="Completed Stripe payments will appear here automatically." /></h3></div><span>OrbitPage fee: {data.limits.feePercent}%</span></div>
        {data.orders.length === 0 ? <div className="shop-empty compact"><ShoppingBag size={24} /><strong>No orders yet</strong></div> : <>
          <div aria-label="Order filters" className="shop-catalog-filters shop-sales-filters" role="group">
            <label>Search orders<input onChange={event => setOrderFilters(current => ({ ...current, query: event.target.value }))} placeholder="Order, product, name or email" type="search" value={orderFilters.query} /></label>
            <label>Payment status<select onChange={event => setOrderFilters(current => ({ ...current, status: event.target.value }))} value={orderFilters.status}><option value="all">All statuses</option>{[...new Set(data.orders.map(order => order.status))].sort().map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
            <label>Product type<select onChange={event => setOrderFilters(current => ({ ...current, type: event.target.value }))} value={orderFilters.type}><option value="all">All types</option><option value="digital">Digital download</option><option value="service">Service</option></select></label>
            <label>From date<input max={orderFilters.to || undefined} onChange={event => setOrderFilters(current => ({ ...current, from: event.target.value }))} type="date" value={orderFilters.from} /></label>
            <label>To date<input min={orderFilters.from || undefined} onChange={event => setOrderFilters(current => ({ ...current, to: event.target.value }))} type="date" value={orderFilters.to} /></label>
          </div>
          {orderFilters.customer && <div className="shop-sales-customer-filter"><span>Customer: {orderFilters.customer}</span><button aria-label="Clear customer filter" className="shop-catalog-edit" onClick={() => setOrderFilters(current => ({ ...current, customer: "", query: current.query === current.customer ? "" : current.query }))} type="button"><X size={14} /></button></div>}
          <div className="shop-catalog-summary"><span role="status">{orderRows.length} of {data.orders.length} orders</span><button disabled={!orderFilters.query && !orderFilters.customer && orderFilters.status === "all" && orderFilters.type === "all" && !orderFilters.from && !orderFilters.to && orderSort.column === "date" && orderSort.descending} onClick={resetOrderFilters} type="button"><RotateCcw size={14} /> Reset filters</button></div>
          <div aria-label="Orders table" className="shop-catalog-grid shop-sales-grid" role="region" tabIndex={0}>
            <table aria-label="Orders" className="shop-catalog-table shop-sales-table shop-orders-table">
              <thead><tr>
                <ShopSortHeader column="order" label="Order" onSort={sortOrders} sort={orderSort} />
                <ShopSortHeader column="date" label="Date" onSort={sortOrders} sort={orderSort} />
                <ShopSortHeader column="product" label="Product" onSort={sortOrders} sort={orderSort} />
                <ShopSortHeader column="customer" label="Customer" onSort={sortOrders} sort={orderSort} />
                <ShopSortHeader column="payment" label="Payment" onSort={sortOrders} sort={orderSort} />
                <ShopSortHeader column="total" label="Total" numeric onSort={sortOrders} sort={orderSort} />
                <th className="shop-catalog-price" scope="col">Refunded</th><th className="shop-catalog-price" scope="col">OrbitPage fee</th><th scope="col">Delivery / booking</th><th scope="col">Details</th>
              </tr></thead>
              <tbody>{orderRows.map(order => <tr key={order.orderId}>
                <th scope="row"><code title={order.orderId}>{order.orderId.slice(0, 12)}</code></th>
                <td><time dateTime={order.paidAt || order.createdAt}>{shopDate(order.paidAt || order.createdAt, locale)}</time><small>{order.paidAt ? "Paid" : "Created"}</small></td>
                <td><strong className="shop-sales-cell-main" title={order.productTitle}>{order.productTitle}</strong><small>{order.productType === "service" ? "Service" : "Digital download"}</small></td>
                <td><span className="shop-sales-cell-main" title={order.buyerEmail || undefined}>{order.buyerEmail || "—"}</span>{order.buyerName && <small>{order.buyerName}</small>}</td>
                <td><span className={`shop-order-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span></td>
                <td className="shop-catalog-price">{money(order.amountTotal, locale)}</td>
                <td className="shop-catalog-price">{money(order.amountRefunded || 0, locale)}</td>
                <td className="shop-catalog-price">{money(order.applicationFeeAmount, locale)}{!!order.applicationFeeRefunded && <small>{money(order.applicationFeeRefunded, locale)} refunded</small>}</td>
                <td>{order.productType === "service" ? <><span className="shop-sales-booking-status">{(order.bookingStatus || "awaiting_booking").replaceAll("_", " ")}</span><small>{order.sessionsRemaining} / {order.sessionsIncluded} sessions remaining</small>{order.scheduledStartAt && <small>{shopDate(order.scheduledStartAt, locale)}</small>}</> : `${order.downloadCount} ${order.downloadCount === 1 ? "download" : "downloads"}`}</td>
                <td><button aria-label={`View order ${order.orderId}`} className="shop-catalog-edit" onClick={() => setSelectedOrder(order)} type="button">View<ArrowUpRight size={14} /></button>{order.intakeSubmittedAt && <small>Questionnaire received</small>}</td>
              </tr>)}</tbody>
            </table>
            {!orderRows.length && <div className="shop-catalog-empty"><Search size={24} /><strong>No orders match these filters.</strong><span>Try another search or reset the filters.</span></div>}
          </div>
          {data.orders.length >= 100 && <p className="shop-sales-scope">The latest 100 orders are loaded. Filters apply to these records.</p>}
        </>}
        <p className="shop-fee-note">{selfHosted ? "Stripe processing fees apply to your account. OrbitPage does not charge a fee." : "Stripe processing fees are charged separately to the seller. OrbitPage retains 5% only on successful sales and returns its fee proportionally when a payment is refunded."}</p>
      </section>}

      {view === "customers" && <section className="panel shop-orders-panel">
        <div className="shop-section-heading"><div><h3>Shop customers <ShopHelp label="About Shop customers" text="Customer access is created automatically after a verified purchase. Delete a customer when handling an erasure request; OrbitPage removes their access and personal data while retaining anonymized financial records." /></h3></div><span>{data.customers.length}</span></div>
        {data.customers.length === 0 ? <div className="shop-empty compact"><ShieldCheck size={24} /><strong>No customers yet</strong></div> : <>
          <div aria-label="Customer filters" className="shop-catalog-filters shop-sales-filters shop-customer-filters" role="group">
            <label>Search customers<input onChange={event => setCustomerFilters(current => ({ ...current, query: event.target.value }))} placeholder="Name, email or customer ID" type="search" value={customerFilters.query} /></label>
            <label>Purchases<select onChange={event => setCustomerFilters(current => ({ ...current, purchases: event.target.value }))} value={customerFilters.purchases}><option value="all">All customers</option><option value="one">One purchase</option><option value="repeat">Repeat customers</option></select></label>
            <label>Last purchase from<input max={customerFilters.to || undefined} onChange={event => setCustomerFilters(current => ({ ...current, from: event.target.value }))} type="date" value={customerFilters.from} /></label>
            <label>Last purchase to<input min={customerFilters.from || undefined} onChange={event => setCustomerFilters(current => ({ ...current, to: event.target.value }))} type="date" value={customerFilters.to} /></label>
          </div>
          <div className="shop-catalog-summary"><span role="status">{customerRows.length} of {data.customers.length} customers</span><button disabled={!customerFilters.query && customerFilters.purchases === "all" && !customerFilters.from && !customerFilters.to && customerSort.column === "date" && customerSort.descending} onClick={resetCustomerFilters} type="button"><RotateCcw size={14} /> Reset filters</button></div>
          <div aria-label="Customers table" className="shop-catalog-grid shop-sales-grid" role="region" tabIndex={0}>
            <table aria-label="Customers" className="shop-catalog-table shop-sales-table shop-customers-table">
              <thead><tr><ShopSortHeader column="email" label="Email" onSort={sortCustomers} sort={customerSort} /><th scope="col">Customer ID</th><ShopSortHeader column="purchases" label="Purchases" numeric onSort={sortCustomers} sort={customerSort} /><ShopSortHeader column="date" label="Last purchase" onSort={sortCustomers} sort={customerSort} /><th scope="col">Actions</th></tr></thead>
              <tbody>{customerRows.map(customer => <tr key={customer.customerId}>
                <th scope="row"><span className="shop-sales-cell-main" title={customer.email}>{customer.email}</span>{customer.name && <small>{customer.name}</small>}</th>
                <td><code title={customer.customerId}>{customer.customerId.slice(0, 12)}</code></td>
                <td className="shop-catalog-price">{customer.orderCount}</td>
                <td><time dateTime={customer.lastPurchaseAt}>{shopDate(customer.lastPurchaseAt, locale)}</time></td>
                <td><div className="shop-sales-actions"><button aria-label={`View orders for ${customer.email}`} className="shop-catalog-edit" disabled={action !== null} onClick={() => { setOrderFilters({ ...EMPTY_ORDER_FILTERS, query: customer.email, customer: customer.email }); setOrderSort({ column: "date", descending: true }); setView("orders"); }} type="button">Orders<ArrowUpRight size={14} /></button><button aria-label={`Delete customer data for ${customer.email}`} className="shop-catalog-edit shop-customer-erase" disabled={action !== null} onClick={() => void deleteCustomerData(customer)} type="button">{action === `delete-customer:${customer.customerId}` ? <LoadingIndicator size={15} /> : <Trash2 size={15} />}Delete data</button></div></td>
              </tr>)}</tbody>
            </table>
            {!customerRows.length && <div className="shop-catalog-empty"><Search size={24} /><strong>No customers match these filters.</strong><span>Try another search or reset the filters.</span></div>}
          </div>
          {data.customers.length >= 100 && <p className="shop-sales-scope">Up to 100 customers are loaded. Filters apply to these records.</p>}
        </>}
      </section>}


      {embedded && shopActions}
      {changed && createPortal(<div className="admin-profile-save-layer"><div aria-label="Unsaved Shop changes" className="admin-profile-save-float" role="group"><button className={SAVE_BUTTON_OUTLINE} disabled={action !== null} onClick={revertChanges} type="button"><RestartAltRounded className="h-4 w-4" style={{ fontSize: 24 }} /> Reset</button><button className={SAVE_BUTTON_PRIMARY} disabled={action !== null} onClick={() => void saveChanges()} type="button">{action !== null ? <LoadingIndicator size={16} state="composing" /> : <Save className="h-4 w-4" />} {action !== null ? "Saving" : "Save"}</button></div></div>, document.body)}
      {logoDialogOpen && <ShopLogoDialog onApply={(file) => { setLogoFile(file); setLogoDialogOpen(false); }} onClose={() => setLogoDialogOpen(false)} />}
      {backLinkDialogOpen && <ShopDialog dirty={backLinkDraft !== (appearance?.backLinkLabel || previewCopy.back)} onClose={() => setBackLinkDialogOpen(false)} title="Back to page"><form onSubmit={(event) => { event.preventDefault(); setAppearance((current) => current ? { ...current, backLinkLabel: backLinkDraft.trim(), backLinkDescription: "" } : current); setBackLinkDialogOpen(false); }}><label>Link text<input maxLength={70} onChange={(event) => setBackLinkDraft(event.target.value)} required value={backLinkDraft} /></label><p>The link always returns to your public page.</p><footer><button className="button secondary" onClick={() => setBackLinkDialogOpen(false)} type="button">Cancel</button><button className="button primary" type="submit">Apply</button></footer></form></ShopDialog>}
      {identityDialogOpen && appearance && previewDesign && <ShopIdentityDialog appearance={appearance} busy={action !== null} design={previewDesign} onClose={() => setIdentityDialogOpen(false)} onSave={saveIdentity} />}
      {selectedOrder && <ShopDialog onClose={() => setSelectedOrder(null)} title="Order details">
        <dl className="shop-order-details">
          <div><dt>Order ID</dt><dd><code>{selectedOrder.orderId}</code></dd></div><div><dt>Product</dt><dd>{selectedOrder.productTitle}</dd></div>
          <div><dt>Customer</dt><dd>{selectedOrder.buyerEmail || "—"}</dd></div><div><dt>Payment</dt><dd className="shop-sales-booking-status">{selectedOrder.status.replaceAll("_", " ")}</dd></div>
          {selectedOrder.buyerName && <div><dt>Name</dt><dd>{selectedOrder.buyerName}</dd></div>}
          {selectedOrder.buyerDetails?.businessName && <div><dt>Business name</dt><dd>{selectedOrder.buyerDetails.businessName}</dd></div>}
          {selectedOrder.buyerDetails?.phone && <div><dt>Phone number</dt><dd>{selectedOrder.buyerDetails.phone}</dd></div>}
          {selectedOrder.buyerDetails?.billingAddress && <div><dt>Billing address</dt><dd>{[selectedOrder.buyerDetails.billingAddress.line1, selectedOrder.buyerDetails.billingAddress.line2, selectedOrder.buyerDetails.billingAddress.postal_code, selectedOrder.buyerDetails.billingAddress.city, selectedOrder.buyerDetails.billingAddress.state, selectedOrder.buyerDetails.billingAddress.country].filter(Boolean).join(", ")}</dd></div>}
          {selectedOrder.buyerDetails?.taxIds.map((taxId, index) => <div key={`tax-${index}`}><dt>Tax ID / VAT number</dt><dd>{taxId.value} ({taxId.type})</dd></div>)}
          {selectedOrder.buyerDetails?.customFields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
          <div><dt>Created</dt><dd>{shopDate(selectedOrder.createdAt, locale)}</dd></div><div><dt>Paid</dt><dd>{shopDate(selectedOrder.paidAt, locale)}</dd></div>
          <div><dt>Original total</dt><dd>{money(selectedOrder.amountTotal, locale)}</dd></div><div><dt>Refunded</dt><dd>{money(selectedOrder.amountRefunded || 0, locale)}</dd></div>
          <div><dt>OrbitPage fee</dt><dd>{money(selectedOrder.applicationFeeAmount, locale)}</dd></div><div><dt>Fee refunded</dt><dd>{money(selectedOrder.applicationFeeRefunded || 0, locale)}</dd></div>
          {selectedOrder.productType === "service" ? <><div><dt>Booking status</dt><dd className="shop-sales-booking-status">{(selectedOrder.bookingStatus || "awaiting_booking").replaceAll("_", " ")}</dd></div><div><dt>Scheduled start</dt><dd>{shopDate(selectedOrder.scheduledStartAt, locale)}</dd></div><div><dt>Sessions remaining</dt><dd>{selectedOrder.sessionsRemaining} / {selectedOrder.sessionsIncluded}</dd></div></> : <div><dt>Downloads</dt><dd>{selectedOrder.downloadCount}</dd></div>}
        </dl>
        {selectedOrder.intakeAnswers.length > 0 && <section className="shop-order-intake"><h3>Questionnaire</h3>{selectedOrder.intakeAnswers.map(answer => <p key={answer.questionId}><strong>{selectedOrder.intakeQuestions.find(question => question.id === answer.questionId)?.prompt || answer.questionId}</strong><span>{answer.answer}</span></p>)}</section>}
        {selectedOrder.productType === "service" && selectedOrder.intakeQuestions.length > 0 && selectedOrder.intakeAnswers.length === 0 && <p>No questionnaire has been submitted yet.</p>}
        <footer><button className="button secondary" onClick={() => setSelectedOrder(null)} type="button">Close</button></footer>
      </ShopDialog>}
      {filesDialogOpen && <ShopDialog busy={action === "save-product"} dirty={files.length > 0 || draft.removedFileIds.length > 0} onClose={() => setFilesDialogOpen(false)} title="Product files"><p>Customers receive these files after purchase. Up to 10 files, {maxFileLabel} each. Changes take effect when you save the product.</p>{draft.removedFileIds.length > 0 && savedProductFiles.length === 0 && files.length === 0 && <p>The product will be hidden until you add a new file.</p>}{feedback?.type === "error" && <p role="alert">{feedback.text}</p>}{productEditorOpen && draft.type === "digital" && <label>Add files<input accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.avif,.gif,.mp4,.webm" disabled={action !== null} multiple onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }} type="file" /></label>}<ul className="shop-file-list">{savedProductFiles.map((file) => <li key={file.id}><FileArchive size={17} /><div><strong>{file.filename}</strong><small>{fileSize(file.sizeBytes)} · Saved</small></div><button aria-label={`Remove uploaded ${file.filename}`} className="shop-delete-button" disabled={action !== null} onClick={() => removeSavedFile(file.id)} type="button"><Trash2 size={16} /></button></li>)}{files.map((file, index) => <li key={`selected-${index}`}><FileArchive size={17} /><div><strong>{file.name}</strong><small>{fileSize(file.size)} · Selected</small></div><button aria-label={`Remove ${file.name}`} disabled={action !== null} onClick={() => setFiles((items) => items.filter((item) => item !== file))} type="button"><X size={16} /></button></li>)}</ul>{uploadProgress.length > 0 && <div aria-label="Upload progress" aria-live="polite" className="shop-upload-progress">{uploadProgress.map((item, index) => <div key={index}><strong>{item.name}</strong><progress aria-label={`Upload ${item.name}`} max={item.size} value={item.loaded} /><small>{fileSize(item.loaded)} / {fileSize(item.size)} · {item.status === "uploading" ? `${Math.round(item.loaded / item.size * 100)}%` : item.status === "verifying" ? "Verifying…" : item.status === "complete" ? "Uploaded" : item.status === "error" ? "Failed — retry Save" : "Waiting"}</small></div>)}</div>}<footer><button className="button primary" disabled={action === "save-product"} onClick={() => setFilesDialogOpen(false)} type="button">Done</button></footer></ShopDialog>}
      {catalogOpen && <ShopDialog className="orbitpage-admin shop-catalog-dialog" onClose={() => setCatalogOpen(false)} title="Product catalog">
        <div className="shop-catalog-filters">
          <label>Search<input onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search products" type="search" value={catalogQuery} /></label>
          <label>Type<select onChange={(event) => setCatalogType(event.target.value)} value={catalogType}><option value="all">All types</option><option value="digital">Digital download</option><option value="service">Service</option></select></label>
          <label>Visibility<select onChange={(event) => setCatalogFilter(event.target.value)} value={catalogFilter}><option value="all">All products</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label>
          <label>Minimum price (€)<input inputMode="decimal" min="0" onChange={(event) => setCatalogMinPrice(event.target.value)} placeholder="0.00" step="0.01" type="number" value={catalogMinPrice} /></label>
          <label>Maximum price (€)<input inputMode="decimal" min="0" onChange={(event) => setCatalogMaxPrice(event.target.value)} placeholder="No limit" step="0.01" type="number" value={catalogMaxPrice} /></label>
        </div>
        <div className="shop-catalog-summary"><span role="status">{catalogProducts.length} of {data.products.length} products</span><button disabled={!catalogQuery && catalogFilter === "all" && catalogType === "all" && !catalogMinPrice && !catalogMaxPrice && catalogSort === "title"} onClick={() => { setCatalogQuery(""); setCatalogFilter("all"); setCatalogType("all"); setCatalogMinPrice(""); setCatalogMaxPrice(""); setCatalogSort("title"); }} type="button"><RotateCcw size={14} /> Reset filters</button></div>
        <div aria-label="Product catalog table" className="shop-catalog-grid" role="region" tabIndex={0}>
          <table aria-label="Products" className="shop-catalog-table">
            <thead><tr>
              <th scope="col">#</th>
              <th aria-sort={catalogSort === "title" ? "ascending" : catalogSort === "title-desc" ? "descending" : "none"} scope="col"><button aria-label="Sort by product" onClick={() => setCatalogSort(catalogSort === "title" ? "title-desc" : "title")} type="button">Product{catalogSort === "title" ? <ArrowUp size={14} /> : catalogSort === "title-desc" ? <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button></th>
              <th scope="col">Type</th><th scope="col">Visibility</th>
              <th aria-sort={catalogSort === "price-asc" ? "ascending" : catalogSort === "price-desc" ? "descending" : "none"} className="shop-catalog-price" scope="col"><button aria-label="Sort by price" onClick={() => setCatalogSort(catalogSort === "price-asc" ? "price-desc" : "price-asc")} type="button">Price{catalogSort === "price-asc" ? <ArrowUp size={14} /> : catalogSort === "price-desc" ? <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button></th>
              <th scope="col">Files</th><th scope="col">Action</th>
            </tr></thead>
            <tbody>{catalogProducts.map((product, index) => <tr className={productEditorOpen && draft.productId === product.productId ? "is-selected" : undefined} key={product.productId}>
              <td className="shop-catalog-number">{index + 1}</td>
              <th scope="row"><div className="shop-catalog-product"><div className="shop-catalog-thumbnail">{product.coverUrl ? <img alt="" src={new URL(product.coverUrl, data.shop?.publicUrl || "https://orbitpage.com").toString()} /> : product.type === "digital" ? <FileArchive size={20} /> : <CalendarDays size={20} />}</div><div><strong>{product.title}</strong><small>{shopProductSummary(product)}</small></div></div></th>
              <td>{product.type === "digital" ? "Digital download" : "Service"}</td>
              <td><span className={`shop-catalog-status ${product.active ? "visible" : "hidden"}`}><span aria-hidden="true" />{product.active ? "Visible" : "Hidden"}</span></td>
              <td className="shop-catalog-price">{money(product.priceCents)}</td>
              <td>{product.type === "digital" ? product.files?.length || (product.file ? 1 : 0) : "—"}</td>
              <td><button aria-label={`Edit ${product.title}`} className="shop-catalog-edit" disabled={action !== null} onClick={() => selectProduct(product.productId)} type="button">Edit<ArrowUpRight size={14} /></button></td>
            </tr>)}</tbody>
          </table>
          {!catalogProducts.length && <div className="shop-catalog-empty"><Search size={24} /><strong>No products match these filters.</strong><span>Try another search or reset the filters.</span></div>}
        </div>
      </ShopDialog>}
    </section>
  );
}
