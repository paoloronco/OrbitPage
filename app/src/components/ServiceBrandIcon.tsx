import {
  SiDeezer,
  SiFacebook,
  SiGithub,
  SiGiphy,
  SiInstagram,
  SiApplemusic,
  SiLoom,
  SiMixcloud,
  SiSoundcloud,
  SiSpotify,
  SiTiktok,
  SiVimeo,
  SiWhatsapp,
  SiYoutube,
  SiGooglecalendar,
  SiGoogleforms,
  SiCalendly,
  SiTypeform,
} from "react-icons/si";
import { brandServiceColors, type BrandServiceProvider } from "@/lib/service-brand";

const brandIcons = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  whatsapp: SiWhatsapp,
  youtube: SiYoutube,
  spotify: SiSpotify,
  apple_music: SiApplemusic,
  deezer: SiDeezer,
  soundcloud: SiSoundcloud,
  mixcloud: SiMixcloud,
  vimeo: SiVimeo,
  loom: SiLoom,
  tiktok: SiTiktok,
  giphy: SiGiphy,
  google_calendar: SiGooglecalendar,
  calendly: SiCalendly,
  typeform: SiTypeform,
  google_forms: SiGoogleforms,
  github: SiGithub,
} satisfies Record<BrandServiceProvider, typeof SiInstagram>;

interface ServiceBrandIconProps {
  provider: BrandServiceProvider;
  className?: string;
}

export const ServiceBrandIcon = ({ provider, className }: ServiceBrandIconProps) => {
  const Icon = brandIcons[provider];
  return (
    <span
      className={className}
      data-service-brand={provider}
      style={{ color: brandServiceColors[provider] }}
      aria-hidden="true"
    >
      <Icon className="h-full w-full" />
    </span>
  );
};
