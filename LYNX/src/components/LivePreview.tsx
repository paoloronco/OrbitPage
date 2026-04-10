import { PublicProfileSection } from "./PublicProfileSection";
import { PublicLinkCard } from "./PublicLinkCard";
import { PublicTextCard } from "./PublicTextCard";
import { LinkData } from "./LinkCard";
import { ThemeConfig } from "@/lib/theme";

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
  const previewBackground = `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20" style={{ height: '560px' }}>
      {/* Scrollable layer */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
        {/* Scaled content — transformOrigin top-left so it aligns flush left */}
        <div
          style={{
            transform: 'scale(0.68)',
            transformOrigin: 'top left',
            width: `${(100 / 0.68).toFixed(2)}%`,
            background: previewBackground,
            padding: '32px 16px 48px',
          }}
        >
          <div style={{ maxWidth: '28rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <PublicProfileSection profile={profile} />

            {visibleLinks.length > 0 && (
              <div className="flex flex-col" style={{ gap: `${theme.cardSpacing}px` }}>
                {visibleLinks.map(link =>
                  link.type === 'text'
                    ? <PublicTextCard key={link.id} link={link} />
                    : <PublicLinkCard key={link.id} link={link} />
                )}
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
      <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-t border-primary/20 px-3 py-2 flex items-center justify-between pointer-events-none">
        <span className="text-xs text-muted-foreground">Live Preview</span>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline hover:no-underline pointer-events-auto"
        >
          Open public page →
        </a>
      </div>
    </div>
  );
};
