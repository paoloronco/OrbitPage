import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";
import { getThemeCssVariables, ThemeConfig } from "@/lib/theme";
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
}

export const LivePreview = ({ profile, links, theme }: LivePreviewProps) => {
  // Show only active links (same logic as PublicView)
  const visibleLinks = links.filter(link => {
    if (link.isActive === false) return false;
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

  // Background derived directly from the theme (document.body is global, so we set it inline)
  const bgType = theme.backgroundMedia?.type;
  const previewBackground = (bgType === 'color' || bgType === 'video' || bgType === 'gif')
    ? theme.background
    : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`;
  const previewThemeVars = getThemeCssVariables(theme) as React.CSSProperties;

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" style={{ height: '560px' }}>
      {/* Scrollable layer */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
        {/* Scaled content — transformOrigin top-left so it aligns flush left */}
        <div
          style={{
            ...previewThemeVars,
            transform: 'scale(0.68)',
            transformOrigin: 'top left',
            width: `${(100 / 0.68).toFixed(2)}%`,
            background: previewBackground,
            color: theme.foreground,
            fontFamily: theme.fontFamily,
            padding: '32px 16px 48px',
          }}
        >
          <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <PublicProfileSection profile={profile} />

            {visibleLinks.length > 0 && (
              <div className="public-card-stack flex flex-col" style={{ gap: `${theme.cardSpacing}px` }}>
            {visibleLinks.map(link => <PublicBlockRenderer key={link.id} link={link} />)}
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

      {/* Footer bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3 py-2 flex items-center justify-between pointer-events-none">
        <span className="text-xs text-slate-500">Live Preview</span>
        <a
          href="/"
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
