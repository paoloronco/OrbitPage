import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { LinkData } from "./LinkCard";
import { withBasePath } from "@/lib/base-path";
import { getSocialRowData, getVideoData } from "@/lib/link-blocks";
import { isLinkVisibleNow } from "@/lib/link-visibility";
import type { ProfileAppearance } from "@/lib/profile-appearance";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: Record<string, string | undefined>;
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
}

interface PublicViewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  footerText?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  ccpaPolicyUrl?: string;
  showOrbitPageBadge?: boolean;
  embedded?: boolean;
}

export const PublicView = ({
  profile,
  links,
  theme,
  footerText,
  privacyPolicyUrl,
  cookiePolicyUrl,
  showOrbitPageBadge = true,
  embedded = false,
}: PublicViewProps) => {
  const privacyHref = privacyPolicyUrl?.trim() ? withBasePath(privacyPolicyUrl.trim()) : undefined;
  const cookieHref = cookiePolicyUrl?.trim() ? withBasePath(cookiePolicyUrl.trim()) : undefined;
  const hasCustomAvatar = Boolean(
    profile.showAvatar !== false &&
    profile.avatar &&
    !profile.avatar.includes('profile-avatar')
  );
  const hasProfileContent = Boolean(
    profile.name?.trim() ||
    profile.bio?.trim() ||
    (profile.socialLinks && Object.values(profile.socialLinks).some(Boolean)) ||
    profile.appearance?.profileDetails?.primary ||
    profile.appearance?.profileDetails?.secondary ||
    hasCustomAvatar
  );

  const visibleLinks = links.filter(link => {
    if (!isLinkVisibleNow(link)) return false;

    if (link.type === 'separator') return true;
    if (link.type === 'heading') return link.title.trim() !== '' || link.description.trim() !== '';
    if (link.type === 'image') return (link.url || link.coverImage) !== '';
    if (link.type === 'video') return Boolean(getVideoData(link.content).mediaUrl);
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

    if (link.backgroundColor || link.textColor || link.icon) {
      return true;
    }

    if (link.type === 'text') {
      return link.title.trim() !== '' &&
        ((link.content?.trim() !== '') ||
         (link.textItems && link.textItems.length > 0 && link.textItems.some(item => item.text.trim() !== '')));
    }
    return link.title.trim() !== '' && link.url.trim() !== '';
  });

  return (
    <main className={`${embedded ? "min-h-full" : "min-h-screen"} py-8 px-4`}>
      <div className="public-page-content mx-auto space-y-6" style={{ maxWidth: theme.maxWidth || "28rem" }}>
        {hasProfileContent && <PublicProfileSection profile={profile} fallbackName={null} surfaceEffect={theme.profileCardEffect} />}

        {visibleLinks.length > 0 && (
          <div className="public-card-stack flex flex-col" style={{ gap: 'var(--card-spacing)' }}>
            {visibleLinks.map((link, index) => (
              <div
                key={link.id}
                className={`content-card-variant-${index % 6}`}
                data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}
                style={getContentCardVariantCssVariables(theme, index) as CSSProperties}
              >
                <PublicBlockRenderer link={link} />
              </div>
            ))}
          </div>
        )}

        <footer className="text-center pt-8 pb-2 space-y-1">
          {footerText && (
            <p className="text-xs text-muted-foreground opacity-70 whitespace-pre-line">
              {footerText}
            </p>
          )}
          {(privacyHref || cookieHref) && (
            <p className="text-xs text-muted-foreground opacity-60 break-words">
              {privacyHref && (
                <a
                  href={privacyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  Privacy Policy
                </a>
              )}
              {privacyHref && cookieHref && <span> | </span>}
              {cookieHref && (
                <a
                  href={cookieHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  Cookie Policy
                </a>
              )}
            </p>
          )}
          {showOrbitPageBadge && (
            <p className="text-xs text-muted-foreground opacity-60">
              Powered by{" "}
              <a
                href="https://github.com/paoloronco/OrbitPage"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                OrbitPage
              </a>
            </p>
          )}
        </footer>
      </div>
    </main>
  );
};
import type { CSSProperties } from "react";
import { getContentCardVariantCssVariables, type ThemeConfig } from "@/lib/theme";
