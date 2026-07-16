import type { CSSProperties } from "react";
import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { isLinkVisibleNow } from "@/lib/link-visibility";
import { getContentCardVariantCssVariables, getThemeCssVariables, ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { Monitor, Smartphone } from "lucide-react";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
}

interface LivePreviewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  publicPageHref?: string;
  device?: PreviewDevice;
}

export type PreviewDevice = "mobile" | "desktop";

export function PreviewDeviceToggle({
  value,
  onChange,
  className = "",
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
  className?: string;
}) {
  return (
    <div className={`admin-preview-device-toggle ${className}`} role="group" aria-label="Preview device">
      <button
        type="button"
        className={value === "mobile" ? "active" : ""}
        aria-pressed={value === "mobile"}
        aria-label="Mobile preview"
        title="Mobile preview"
        onClick={() => onChange("mobile")}
      >
        <Smartphone className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={value === "desktop" ? "active" : ""}
        aria-pressed={value === "desktop"}
        aria-label="Desktop preview"
        title="Desktop preview"
        onClick={() => onChange("desktop")}
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}

export const LivePreview = ({ profile, links, theme, publicPageHref = "/", device = "mobile" }: LivePreviewProps) => {
  const hasCustomAvatar = Boolean(
    profile.showAvatar !== false &&
    profile.avatar &&
    !profile.avatar.includes('profile-avatar')
  );
  const hasProfileContent = Boolean(
    profile.name?.trim() ||
    profile.bio?.trim() ||
    (profile.socialLinks && Object.values(profile.socialLinks).some(Boolean)) ||
    hasCustomAvatar
  );
  const visibleLinks = links.filter(link => {
    if (!isLinkVisibleNow(link)) return false;
    if (link.type === 'separator') return true;
    if (link.type === 'heading') return link.title.trim() !== '' || link.description.trim() !== '';
    if (link.type === 'image') return (link.url || link.coverImage) !== '';
    if (link.type === 'social_row') {
      return (getSocialRowData(link.content).items || []).length > 0;
    }
    if (link.type === 'contact' || link.type === 'callout' || link.type === 'map' || link.type === 'event' || link.type === 'embed') {
      return (
        link.title.trim() !== '' ||
        link.description.trim() !== '' ||
        (link.content || '').trim() !== ''
      );
    }
    if (link.backgroundColor || link.textColor || link.icon) return true;
    if (link.type === 'text') {
      return (
        link.title.trim() !== '' &&
        ((link.content?.trim() !== '') ||
          (link.textItems && link.textItems.length > 0 &&
            link.textItems.some(item => item.text.trim() !== '')))
      );
    }
    return link.title.trim() !== '' && (link.url?.trim() !== '');
  });

  const bgType = theme.backgroundMedia?.type;
  const previewBackground = (bgType === 'color' || bgType === 'video' || bgType === 'gif')
    ? theme.background
    : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`;
  const previewThemeVars = getThemeCssVariables(theme) as CSSProperties;

  return (
    <div className={`admin-preview-device admin-preview-device--${device}`} data-preview-device={device}>
      <div className="admin-preview-device__hardware">
        {device === "mobile" ? (
          <>
            <span className="admin-preview-device__side-button admin-preview-device__side-button--one" />
            <span className="admin-preview-device__side-button admin-preview-device__side-button--two" />
            <span className="admin-preview-device__island"><i /></span>
          </>
        ) : (
          <div className="admin-preview-device__browser-bar" aria-hidden="true">
            <span><i /><i /><i /></span>
            <b>{publicPageHref.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Public preview"}</b>
          </div>
        )}
        <div className="admin-preview-device__screen">
          <div className="admin-live-preview relative overflow-hidden bg-white">
            <div className="admin-live-preview__scroll absolute inset-0 overflow-y-auto overflow-x-hidden">
              <div
                className="admin-live-preview__page min-h-full"
                style={{
                  ...previewThemeVars,
                  background: previewBackground,
                  color: theme.foreground,
                  fontFamily: theme.fontFamily,
                  padding: device === "desktop" ? '38px 32px 56px' : '32px 16px 56px',
                }}
              >
                <div style={{ maxWidth: theme.maxWidth || '28rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {hasProfileContent && <PublicProfileSection profile={profile} fallbackName={null} />}

                  {visibleLinks.length > 0 && (
                    <div className="public-card-stack flex flex-col" style={{ gap: `${theme.cardSpacing}px` }}>
                    {visibleLinks.map((link, index) => (
                      <div
                        key={link.id}
                        className={`content-card-variant-${index % 6}`}
                        style={getContentCardVariantCssVariables(theme, index) as CSSProperties}
                      >
                        <PublicBlockRenderer link={link} />
                      </div>
                    ))}
                    </div>
                  )}

                  {visibleLinks.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm opacity-60">
                      No visible links yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {device === "desktop" && <div className="admin-preview-device__stand" aria-hidden="true"><i /></div>}
    </div>
  );
};
