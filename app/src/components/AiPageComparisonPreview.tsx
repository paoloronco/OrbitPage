import { useState } from "react";
import { LivePreview } from "./LivePreview";
import type { LinkData } from "./LinkCard";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { normalizeTheme, type ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { useAppI18n } from "@/lib/i18n";

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
  const beforeProps = previewProps(before);
  const afterProps = previewProps(after);

  return (
    <section className="ai-page-comparison" aria-label={tr("Page preview before and after", "Anteprima pagina prima e dopo")}>
      <div className="ai-page-comparison__labels" aria-hidden="true">
        <span>{tr("Before", "Prima")}</span>
        <span>{tr("After", "Dopo")}</span>
      </div>
      <div className="ai-page-comparison__viewport">
        <div className="ai-page-comparison__layer">
          <LivePreview {...beforeProps} device="desktop" />
        </div>
        <div
          aria-hidden="true"
          className="ai-page-comparison__layer ai-page-comparison__layer--after"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        >
          <LivePreview {...afterProps} device="desktop" />
        </div>
        <span className="ai-page-comparison__divider" style={{ left: `${split}%` }} aria-hidden="true" />
        <input
          aria-label={tr("Move to compare before and after", "Sposta per confrontare prima e dopo")}
          max="100"
          min="0"
          onChange={(event) => setSplit(Number(event.target.value))}
          type="range"
          value={split}
        />
      </div>
    </section>
  );
}
