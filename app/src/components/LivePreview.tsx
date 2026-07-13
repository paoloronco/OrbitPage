import type { CSSProperties } from "react";
import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { isLinkVisibleNow } from "@/lib/link-visibility";
import { getContentCardVariantCssVariables, getThemeCssVariables, ThemeConfig } from "@/lib/theme";
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
}

export const LivePreview = ({ profile, links, theme, publicPageHref = "/" }: LivePreviewProps) => {
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
    <div className="admin-live-preview relative overflow-hidden border border-slate-200 bg-white">
      <div className="admin-live-preview__scroll absolute inset-0 overflow-y-auto overflow-x-hidden">
        <div
          className="admin-live-preview__page min-h-full"
          style={{
            ...previewThemeVars,
            background: previewBackground,
            color: theme.foreground,
            fontFamily: theme.fontFamily,
            padding: '32px 16px 72px',
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

      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-3 py-2 flex items-center justify-between pointer-events-none">
        <span className="text-xs font-medium text-slate-500">Live preview</span>
        <a
          href={publicPageHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-700 underline hover:no-underline pointer-events-auto"
        >
          Open public page →
        </a>
      </div>
    </div>
  );
};
