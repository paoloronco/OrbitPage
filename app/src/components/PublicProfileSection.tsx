import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BriefcaseBusiness, Linkedin, Github, Instagram, Facebook, MapPin, Twitter, Youtube } from "lucide-react";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath } from "@/lib/base-path";
import { getProfileAppearanceStyle, getProfileAvatarStyle, type ProfileAppearance } from "@/lib/profile-appearance";

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
}

interface PublicProfileSectionProps {
  profile: ProfileData;
  fallbackName?: string | null;
}

export const PublicProfileSection = ({ profile, fallbackName = "Name or brand" }: PublicProfileSectionProps) => {
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");
  const displayName = profile.name?.trim() || fallbackName || "";
  const hasSocialLinks = Boolean(
    profile.socialLinks && Object.values(profile.socialLinks).some(link => link)
  );
  const profileDetails = profile.appearance?.profileDetails;
  const hasProfileDetails = Boolean(profileDetails?.primary || profileDetails?.secondary);
  const hasVisibleProfile = Boolean(displayName || hasBio || hasSocialLinks || hasProfileDetails || profile.showAvatar !== false);

  if (!hasVisibleProfile) return null;

  return (
    <Card className="profile-card glass-card p-8 text-center transition-smooth hover:glow-effect" style={getProfileAppearanceStyle(profile.appearance)}>
      {profile.showAvatar !== false && (
        <div className="mb-6 flex justify-center">
          <Avatar className="profile-card__avatar" style={getProfileAvatarStyle(profile.appearance)}>
            <AvatarImage className="object-cover object-center" src={getAvatarUrl(profile.avatar)} alt={profile.name || 'Page avatar'} />
            <AvatarFallback className="profile-card__avatar-fallback text-4xl font-bold">{profile.name?.charAt(0) ?? 'U'}</AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="space-y-4">
        {displayName && (
          <h1 className="profile-card__title mb-2 font-bold" style={{ ...(profile.nameFontSize ? { fontSize: profile.nameFontSize } : { fontSize: '2rem' }) }}>
            {displayName}
          </h1>
        )}

        {hasProfileDetails && (
          <div className="profile-card__details flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {profileDetails?.primary && <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" />{profileDetails.primary}</span>}
            {profileDetails?.secondary && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profileDetails.secondary}</span>}
          </div>
        )}
        
        {/* Social Icons */}
        {hasSocialLinks && (
          <div className="profile-card__socials mb-4 flex flex-wrap justify-center gap-3">
            {profile.socialLinks.linkedin && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.github && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub profile">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.instagram && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram profile">
                  <Instagram className="h-4 w-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.facebook && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook profile">
                  <Facebook className="h-4 w-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.twitter && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter profile">
                  <Twitter className="h-4 w-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.youtube && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube channel">
                  <Youtube className="w-4 h-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.tiktok && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok profile">
                  <TikTokIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.discord && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.discord} target="_blank" rel="noopener noreferrer" aria-label="Discord profile">
                  <DiscordIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.telegram && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram profile">
                  <TelegramIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.whatsapp && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp profile">
                  <WhatsAppIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
            {profile.socialLinks.mastodon && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="profile-card__social h-9 w-9"
              >
                <a href={profile.socialLinks.mastodon} target="_blank" rel="noopener noreferrer" aria-label="Mastodon profile">
                  <MastodonIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        )}
        
        {hasBio && (
          <p className="profile-card__bio whitespace-pre-line leading-relaxed" style={{ ...(profile.bioFontSize ? { fontSize: profile.bioFontSize } : {}) }}>
            {profile.bio}
          </p>
        )}
      </div>
    </Card>
  );
};

function getAvatarUrl(avatar?: string | null) {
  if (!avatar) return profileAvatar as unknown as string;
  if (avatar.startsWith('data:') || avatar.startsWith('blob:') || avatar.startsWith('http')) return avatar;
  return internalAssetPath(avatar) || (profileAvatar as unknown as string);
}
