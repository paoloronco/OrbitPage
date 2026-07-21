import type { ComponentType } from "react";
import { Facebook, FileText, Github, Globe2, Instagram, Link2, Linkedin, Mail, Twitter, Youtube } from "lucide-react";
import type { SocialLinkPlatform } from "@/lib/link-blocks";
import { detectCompactLinkPlatform } from "@/lib/compact-links";
import { DiscordIcon, TelegramIcon, TikTokIcon, WhatsAppIcon } from "./SocialIcons";

type IconComponent = ComponentType<{ className?: string }>;

const platformIcons: Partial<Record<Exclude<SocialLinkPlatform, "auto">, IconComponent>> = {
  page: FileText,
  link: Link2,
  website: Globe2,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTokIcon,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: WhatsAppIcon,
  telegram: TelegramIcon,
  discord: DiscordIcon,
  github: Github,
  email: Mail,
};

export function CompactLinkIcon({ platform = "auto", url, customIcon, className = "h-5 w-5" }: { platform?: SocialLinkPlatform; url: string; customIcon?: string; className?: string }) {
  if (customIcon) return <span className="compact-link-custom-icon" aria-hidden="true">{customIcon}</span>;
  const resolved = platform === "auto" ? detectCompactLinkPlatform(url) : platform;
  const Icon = platformIcons[resolved] || Link2;
  return <Icon className={className} aria-hidden="true" />;
}
