import { PublicProfileSection } from "./PublicProfileSection";
import { PublicLinkCard } from "./PublicLinkCard";
import { PublicTextCard } from "./PublicTextCard";
import { PublicSeparatorCard } from "./PublicSeparatorCard";
import { LinkData } from "./LinkCard";
import { withBasePath } from "@/lib/base-path";
import { isLinkVisibleNow } from "@/lib/link-visibility";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: Record<string, string | undefined>;
  nameFontSize?: string;
  bioFontSize?: string;
}

interface PublicViewProps {
  profile: ProfileData;
  links: LinkData[];
  footerText?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  ccpaPolicyUrl?: string;
}

export const PublicView = ({
  profile,
  links,
  footerText,
  privacyPolicyUrl,
  cookiePolicyUrl,
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
    hasCustomAvatar
  );

  const visibleLinks = links.filter(link => {
    if (!isLinkVisibleNow(link)) return false;

    if (link.type === 'separator') return true;

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
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {hasProfileContent && <PublicProfileSection profile={profile} fallbackName={null} />}

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
        </footer>
      </div>
    </main>
  );
};
