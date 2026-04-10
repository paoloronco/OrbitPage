import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin, Github, Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import profileAvatar from "@/assets/profile-avatar.jpg";

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
}

export const PublicProfileSection = ({ profile }: PublicProfileSectionProps) => {
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");

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
        <h1 className="font-bold text-foreground mb-2" style={{ ...(profile.nameFontSize ? { fontSize: profile.nameFontSize } : { fontSize: '2rem' }) }}>
          {profile.name || "Your Name"}
        </h1>
        
        {/* Social Icons */}
        {profile.socialLinks && Object.values(profile.socialLinks).some(link => link) && (
          <div className="flex justify-center gap-3 mb-4">
            {profile.socialLinks.linkedin && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-blue-600/20"
                onClick={() => window.open(profile.socialLinks?.linkedin, '_blank')}
              >
                <Linkedin className="w-4 h-4 text-blue-600" />
              </Button>
            )}
            {profile.socialLinks.github && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-foreground/20"
                onClick={() => window.open(profile.socialLinks?.github, '_blank')}
              >
                <Github className="w-4 h-4 text-foreground" />
              </Button>
            )}
            {profile.socialLinks.instagram && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-pink-500/20"
                onClick={() => window.open(profile.socialLinks?.instagram, '_blank')}
              >
                <Instagram className="w-4 h-4 text-pink-500" />
              </Button>
            )}
            {profile.socialLinks.facebook && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-blue-700/20"
                onClick={() => window.open(profile.socialLinks?.facebook, '_blank')}
              >
                <Facebook className="w-4 h-4 text-blue-700" />
              </Button>
            )}
            {profile.socialLinks.twitter && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-foreground/20"
                onClick={() => window.open(profile.socialLinks?.twitter, '_blank')}
              >
                <Twitter className="w-4 h-4 text-foreground" />
              </Button>
            )}
            {profile.socialLinks.youtube && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-red-600 hover:bg-red-600/20"
                onClick={() => window.open(profile.socialLinks?.youtube, '_blank')}
              >
                <Youtube className="w-4 h-4" />
              </Button>
            )}
            {profile.socialLinks.tiktok && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-foreground hover:bg-foreground/20"
                onClick={() => window.open(profile.socialLinks?.tiktok, '_blank')}
              >
                <TikTokIcon className="w-4 h-4" />
              </Button>
            )}
            {profile.socialLinks.discord && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-indigo-500 hover:bg-indigo-500/20"
                onClick={() => window.open(profile.socialLinks?.discord, '_blank')}
              >
                <DiscordIcon className="w-4 h-4" />
              </Button>
            )}
            {profile.socialLinks.telegram && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-blue-500 hover:bg-blue-500/20"
                onClick={() => window.open(profile.socialLinks?.telegram, '_blank')}
              >
                <TelegramIcon className="w-4 h-4" />
              </Button>
            )}
            {profile.socialLinks.whatsapp && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-green-500 hover:bg-green-500/20"
                onClick={() => window.open(profile.socialLinks?.whatsapp, '_blank')}
              >
                <WhatsAppIcon className="w-4 h-4" />
              </Button>
            )}
            {profile.socialLinks.mastodon && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-violet-500 hover:bg-violet-500/20"
                onClick={() => window.open(profile.socialLinks?.mastodon, '_blank')}
              >
                <MastodonIcon className="w-4 h-4" />
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
  if (avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar.replace(/^\/+/, '')}`;
}