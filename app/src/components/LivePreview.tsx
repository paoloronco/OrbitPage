import type { CSSProperties, ReactNode } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { BackgroundLayer } from "./BackgroundLayer";
import { PublicView } from "./PublicView";
import type { LinkData } from "./LinkCard";
import { getThemeCssVariables, type ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";

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
    youtube?: string;
    tiktok?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
    mastodon?: string;
  };
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
  footerText?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

interface LivePreviewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  publicPageHref?: string;
  device?: PreviewDevice;
  showOrbitPageBadge?: boolean;
}

export type PreviewDevice = "mobile" | "desktop";

export function PreviewDeviceFrame({
  device,
  publicPageHref = "/",
  children,
}: {
  device: PreviewDevice;
  publicPageHref?: string;
  children: ReactNode;
}) {
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
        <div className="admin-preview-device__screen">{children}</div>
      </div>
      {device === "desktop" && <div className="admin-preview-device__stand" aria-hidden="true"><i /></div>}
    </div>
  );
}

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

export const LivePreview = ({
  profile,
  links,
  theme,
  publicPageHref = "/",
  device = "mobile",
  showOrbitPageBadge = true,
}: LivePreviewProps) => {
  const bgType = theme.backgroundMedia?.type;
  const previewBackground = (bgType === "color" || bgType === "video" || bgType === "gif")
    ? theme.background
    : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`;
  const previewThemeVars = getThemeCssVariables(theme) as CSSProperties;

  return (
    <PreviewDeviceFrame device={device} publicPageHref={publicPageHref}>
      <div className="admin-live-preview relative overflow-hidden bg-white">
        <div className="admin-live-preview__scroll absolute inset-0 overflow-y-auto overflow-x-hidden">
          <div
            className="admin-live-preview__page relative isolate min-h-full overflow-hidden"
            style={{
              ...previewThemeVars,
              background: previewBackground,
              color: theme.foreground,
              fontFamily: theme.fontFamily,
            }}
          >
            {(bgType === "video" || bgType === "gif") && theme.backgroundMedia?.mediaUrl && (
              <BackgroundLayer config={theme.backgroundMedia} mode="container" />
            )}
            <div className="relative z-[1] min-h-full">
              <PublicView
                profile={profile}
                links={links}
                theme={theme}
                footerText={profile.footerText}
                privacyPolicyUrl={profile.privacyPolicyUrl || "/privacy"}
                cookiePolicyUrl={profile.cookiePolicyUrl || "/cookies"}
                showOrbitPageBadge={showOrbitPageBadge}
                embedded
              />
            </div>
          </div>
        </div>
      </div>
    </PreviewDeviceFrame>
  );
};
