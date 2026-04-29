import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin, Github, Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath } from "@/lib/base-path";

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
}

interface PublicProfileSectionProps {
  profile: ProfileData;
  fallbackName?: string | null;
}

export const PublicProfileSection = ({ profile, fallbackName = "Your Name" }: PublicProfileSectionProps) => {
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");
  const displayName = profile.name?.trim() || fallbackName || "";
  const hasSocialLinks = Boolean(
    profile.socialLinks && Object.values(profile.socialLinks).some(link => link)
  );
  const hasVisibleProfile = Boolean(displayName || hasBio || hasSocialLinks || profile.showAvatar !== false);

  if (!hasVisibleProfile) return null;

  return (
    <Card className="glass-card p-8 text-center transition-smooth hover:glow-effect">
      {profile.showAvatar !== false && (
        <div className="mb-6 flex justify-center">
          <Avatar className="w-28 h-28">
            <AvatarImage className="object-cover object-center" src={getAvatarUrl(profile.avatar)} alt={profile.name || 'Profile avatar'} />
            <AvatarFallback className="text-4xl font-bold gradient-text">{profile.name?.charAt(0) ?? 'U'}</AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="space-y-4">
        {displayName && (
          <h1 className="font-bold text-foreground mb-2" style={{ ...(profile.nameFontSize ? { fontSize: profile.nameFontSize } : { fontSize: '2rem' }) }}>
            {displayName}
          </h1>
        )}
        
        {/* Social Icons */}
        {hasSocialLinks && (
          <div className="flex justify-center gap-3 mb-4">
            {profile.socialLinks.linkedin && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-blue-600/20"
              >
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile">
                  <Linkedin className="w-4 h-4 text-blue-600" />
                </a>
              </Button>
            )}
            {profile.socialLinks.github && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-foreground/20"
              >
                <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub profile">
                  <Github className="w-4 h-4 text-foreground" />
                </a>
              </Button>
            )}
            {profile.socialLinks.instagram && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-pink-500/20"
              >
                <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram profile">
                  <Instagram className="w-4 h-4 text-pink-500" />
                </a>
              </Button>
            )}
            {profile.socialLinks.facebook && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-blue-700/20"
              >
                <a href={profile.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook profile">
                  <Facebook className="w-4 h-4 text-blue-700" />
                </a>
              </Button>
            )}
            {profile.socialLinks.twitter && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-foreground/20"
              >
                <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter profile">
                  <Twitter className="w-4 h-4 text-foreground" />
                </a>
              </Button>
            )}
            {profile.socialLinks.youtube && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-red-600 hover:bg-red-600/20"
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
                className="w-8 h-8 text-foreground hover:bg-foreground/20"
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
                className="w-8 h-8 text-indigo-500 hover:bg-indigo-500/20"
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
                className="w-8 h-8 text-blue-500 hover:bg-blue-500/20"
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
                className="w-8 h-8 text-green-500 hover:bg-green-500/20"
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
                className="w-8 h-8 text-violet-500 hover:bg-violet-500/20"
              >
                <a href={profile.socialLinks.mastodon} target="_blank" rel="noopener noreferrer" aria-label="Mastodon profile">
                  <MastodonIcon className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        )}
        
        {hasBio && (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line" style={{ ...(profile.bioFontSize ? { fontSize: profile.bioFontSize } : {}) }}>
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
