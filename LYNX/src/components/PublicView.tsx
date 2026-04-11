import { PublicProfileSection } from "./PublicProfileSection";
import { PublicLinkCard } from "./PublicLinkCard";
import { PublicTextCard } from "./PublicTextCard";
import { PublicSeparatorCard } from "./PublicSeparatorCard";
import { LinkData } from "./LinkCard";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
}

interface PublicViewProps {
  profile: ProfileData;
  links: LinkData[];
  footerText?: string;
}

export const PublicView = ({ profile, links, footerText }: PublicViewProps) => {
  const visibleLinks = links.filter(link => {
    // Respect visibility toggle
    if (link.isActive === false) return false;

    // Always show active separators
    if (link.type === 'separator') return true;

    // Always include links with personalizations, even if they're missing some fields
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
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <PublicProfileSection profile={profile} />
        
        {visibleLinks.length > 0 && (
          <div className="flex flex-col" style={{ gap: 'var(--card-spacing)' }}>
            {visibleLinks.map((link) => (
              link.type === 'separator' ? (
                <PublicSeparatorCard key={link.id} link={link} />
              ) : link.type === 'text' ? (
                <PublicTextCard key={link.id} link={link} />
              ) : (
                <PublicLinkCard key={link.id} link={link} />
              )
            ))}
          </div>
        )}
        
        {/* Footer — "Powered by Lynx" is always shown and cannot be removed */}
        <div className="text-center pt-8 pb-2 space-y-1">
          {footerText && (
            <p className="text-xs text-muted-foreground opacity-70 whitespace-pre-line">
              {footerText}
            </p>
          )}
          <p className="text-xs text-muted-foreground opacity-60">
            Powered by{" "}
            <a
              href="https://github.com/paoloronco/Lynx"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Lynx
            </a>
            {" "}
            <span className="opacity-70">v{__APP_VERSION__}</span>
          </p>
        </div>
      </div>
    </div>
  );
};