import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import { OrbitPageBrand } from "./OrbitPageBrand";
import type { LinkData } from "./LinkCard";
import { withTenantBasePath } from "@/lib/base-path";
import { getInternalLinksData, getSocialRowData, getVideoData, isSocialRowContent } from "@/lib/link-blocks";
import { isLinkVisibleNow } from "@/lib/link-visibility";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import type { ProfileLayout } from "@/lib/profile-layout";

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
  embeddedViewport?: "mobile" | "desktop";
  editorSelection?: PublicEditorTarget | null;
  onEditorSelect?: (target: PublicEditorTarget) => void;
  profileLayoutEditing?: boolean;
  onProfileLayoutChange?: (layout: ProfileLayout) => void;
}

export type PublicEditorTarget =
  | { kind: "page" }
  | { kind: "profile" }
  | { kind: "link"; id: string };

export const PublicView = ({
  profile,
  links,
  theme,
  footerText,
  privacyPolicyUrl,
  cookiePolicyUrl,
  showOrbitPageBadge = true,
  embedded = false,
  embeddedViewport = "mobile",
  editorSelection = null,
  onEditorSelect,
  profileLayoutEditing = false,
  onProfileLayoutChange,
}: PublicViewProps) => {
  const privacyHref = privacyPolicyUrl?.trim() ? withTenantBasePath(privacyPolicyUrl.trim()) : undefined;
  const cookieHref = cookiePolicyUrl?.trim() ? withTenantBasePath(cookiePolicyUrl.trim()) : undefined;
  const hasCustomAvatar = Boolean(
    profile.showAvatar !== false &&
    profile.avatar &&
    !profile.avatar.includes('profile-avatar')
  );
  const hasProfileContent = Boolean(profileLayoutEditing ||
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
    if (link.type === 'social_row' || isSocialRowContent(link.content)) {
      return (getSocialRowData(link.content).items || []).length > 0;
    }
    if (link.type === 'internal_links') return getInternalLinksData(link.content).items.length > 0;
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

  const viewportClass = embedded
    ? `public-page-root--preview-${embeddedViewport}`
    : "public-page-root--standalone";

  return (
    <main
      className={`public-page-root ${viewportClass} ${onEditorSelect ? "public-page-root--editor" : ""} ${embedded ? "min-h-full" : "min-h-screen"} py-8 px-4`}
      onClick={onEditorSelect ? () => onEditorSelect({ kind: "page" }) : undefined}
    >
      <div
        className="public-page-content mx-auto space-y-6"
        style={{ "--public-page-max-width": theme.maxWidth || "28rem" } as CSSProperties}
      >
        {hasProfileContent && (
          <div
            aria-label={onEditorSelect ? "Edit profile and page identity" : undefined}
            className={`public-editor-target public-editor-target--profile${editorSelection?.kind === "profile" ? " is-selected" : ""}${profileLayoutEditing ? " is-layout-editing" : ""}`}
            data-public-editor-target={onEditorSelect ? "profile" : undefined}
            onClick={profileLayoutEditing ? (event) => event.stopPropagation() : undefined}
            onClickCapture={onEditorSelect && !profileLayoutEditing ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onEditorSelect({ kind: "profile" });
            } : undefined}
            onKeyDown={onEditorSelect ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onEditorSelect({ kind: "profile" });
            } : undefined}
            role={onEditorSelect && !profileLayoutEditing ? "button" : undefined}
            tabIndex={onEditorSelect && !profileLayoutEditing ? 0 : undefined}
          >
            <PublicProfileSection
              profile={profile}
              fallbackName={null}
              layoutEditing={profileLayoutEditing}
              onLayoutChange={onProfileLayoutChange}
              surfaceEffect={theme.profileCardEffect}
            />
          </div>
        )}

        {visibleLinks.length > 0 && (
          <div className="public-card-stack flex flex-col" style={{ gap: 'var(--card-spacing)' }}>
            {visibleLinks.map((link, index) => (
              <div
                key={link.id}
                aria-label={onEditorSelect ? `Edit ${link.title || "content block"}` : undefined}
                className={`content-card-variant-${index % 6} public-editor-target public-editor-target--link${editorSelection?.kind === "link" && editorSelection.id === link.id ? " is-selected" : ""}`}
                data-public-editor-link-id={onEditorSelect ? link.id : undefined}
                data-public-editor-target={onEditorSelect ? "link" : undefined}
                data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}
                onClickCapture={onEditorSelect ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEditorSelect({ kind: "link", id: link.id });
                } : undefined}
                onKeyDown={onEditorSelect ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onEditorSelect({ kind: "link", id: link.id });
                } : undefined}
                role={onEditorSelect ? "button" : undefined}
                style={getContentCardVariantCssVariables(theme, index) as CSSProperties}
                tabIndex={onEditorSelect ? 0 : undefined}
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
            <p className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground opacity-70">
              <span>Powered by</span>
              <a
                aria-label="OrbitPage"
                href="https://orbitpage.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-md text-current no-underline transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <OrbitPageBrand className="gap-1.5" size="xs" />
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
