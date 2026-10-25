import { ChevronLeft, ChevronRight } from "./ui/material-icons";
import { useState } from "react";
import { LivePreview } from "./LivePreview";
import type { LinkData } from "./LinkCard";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { normalizeTheme, type ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { useAppI18n } from "@/lib/i18n";
import { PreviewDeviceToggle, type PreviewDevice } from "./PreviewDeviceToggle";
import type { OrbitPageMenu } from "@orbitpage/page-schema";
import type { ShopAiDraft } from "../../packages/shop/schema.js";

type PreviewProfile = {
  name?: string;
  bio?: string;
  avatar?: string;
  showAvatar?: boolean;
  show_avatar?: boolean | number;
  socialLinks?: Record<string, string | undefined>;
  social_links?: Record<string, string | undefined>;
  nameFontSize?: string;
  name_font_size?: string;
  bioFontSize?: string;
  bio_font_size?: string;
  appearance?: ProfileAppearance;
  footerText?: string;
  footer_text?: string;
  privacyPolicyUrl?: string;
  privacy_policy_url?: string;
  cookiePolicyUrl?: string;
  cookie_policy_url?: string;
  showOrbitPageBadge?: boolean;
  show_orbitpage_badge?: boolean;
};

export type AiPagePreviewSnapshot = {
  profile: PreviewProfile;
  links: LinkData[];
  theme: ThemeConfig;
  menu?: OrbitPageMenu;
  shopProducts?: ShopAiDraft[];
  shopCurrency?: string;
};

function previewProps(snapshot: AiPagePreviewSnapshot) {
  const profile = snapshot.profile || {};
  return {
    profile: {
      name: profile.name || "",
      bio: profile.bio || "",
      avatar: profile.avatar || "",
      showAvatar: typeof profile.show_avatar !== "undefined"
        ? profile.show_avatar !== 0 && profile.show_avatar !== false
        : profile.showAvatar,
      socialLinks: profile.social_links || profile.socialLinks || {},
      nameFontSize: profile.name_font_size || profile.nameFontSize,
      bioFontSize: profile.bio_font_size || profile.bioFontSize,
      appearance: profile.appearance || {},
      footerText: profile.footer_text || profile.footerText,
      privacyPolicyUrl: profile.privacy_policy_url || profile.privacyPolicyUrl,
      cookiePolicyUrl: profile.cookie_policy_url || profile.cookiePolicyUrl,
    },
    links: normalizeLinkDtos(snapshot.links || []),
    theme: normalizeTheme(snapshot.theme),
    showOrbitPageBadge: profile.show_orbitpage_badge ?? profile.showOrbitPageBadge ?? true,
  };
}

export function AiPageComparisonPreview({
  before,
  after,
}: {
  before: AiPagePreviewSnapshot;
  after: AiPagePreviewSnapshot;
}) {
  const { tr } = useAppI18n();
  const [split, setSplit] = useState(50);
  const [device, setDevice] = useState<PreviewDevice>("mobile");
  const beforeProps = previewProps(before);
  const afterProps = previewProps(after);
  const menuItems = after.menu?.items.filter(item => !before.menu?.items.some(existing => existing.id === item.id)) || [];
  const pageChanged = JSON.stringify([before.profile, before.links, before.theme]) !== JSON.stringify([after.profile, after.links, after.theme]);
  const showPage = pageChanged || (!after.shopProducts?.length && !menuItems.length);
  const amount = (price: number, currency?: string) => `${(price / 100).toFixed(2)}${currency ? ` ${currency.toUpperCase()}` : ""}`;

  return (
    <section className="ai-page-comparison" aria-label={tr("Page preview before and after", "Anteprima pagina prima e dopo")}>
      <div className="ai-page-comparison__content">
        {!!after.shopProducts?.length && <div className="ai-catalog-preview">
          <h3>{tr("Draft Shop products", "Prodotti Shop in bozza")}</h3>
          {after.shopProducts.map(product => <article key={product.productId}>
            <strong>{product.title}</strong><span>{amount(product.priceCents, after.shopCurrency)}</span>
            <p>{product.description}</p><small>{tr("Draft · not available for purchase", "Bozza · non acquistabile")}</small>
          </article>)}
        </div>}
        {!!menuItems.length && <div className="ai-catalog-preview">
          <h3>{tr("New menu items", "Nuovi piatti nel menu")}</h3>
          {menuItems.map(item => <article key={item.id}>
            <strong>{item.name}</strong><span>{amount(item.priceMinor, after.menu?.currency)}</span>
            <p>{item.description}</p><small>{after.menu?.sections.find(section => section.id === item.sectionId)?.name}{!after.menu?.enabled && tr(" · Menu remains private", " · Il menu resta privato")}</small>
          </article>)}
        </div>}
        {showPage && <>
        <div className="ai-page-comparison__labels" aria-hidden="true">
          <span>{tr("Before", "Prima")}</span>
          <span>{tr("After", "Dopo")}</span>
        </div>
        <div className="ai-page-comparison__viewport" data-device={device}>
          <div className="ai-page-comparison__layer">
            <LivePreview {...beforeProps} device={device} />
          </div>
          <div
            aria-hidden="true"
            className="ai-page-comparison__layer ai-page-comparison__layer--after"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          >
            <LivePreview {...afterProps} device={device} />
          </div>
          <span className="ai-page-comparison__divider" style={{ left: `${split}%` }} aria-hidden="true">
            <span className="ai-page-comparison__handle"><ChevronLeft /><ChevronRight /></span>
          </span>
          <input
            aria-label={tr("Move to compare before and after", "Sposta per confrontare prima e dopo")}
            max="100"
            min="0"
            onChange={(event) => setSplit(Number(event.target.value))}
            type="range"
            value={split}
          />
        </div>
        </>}
      </div>
      {showPage && <PreviewDeviceToggle className="ai-page-comparison__device" value={device} onChange={setDevice} />}
    </section>
  );
}
