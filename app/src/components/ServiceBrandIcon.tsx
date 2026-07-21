import {
  SiDeezer,
  SiGithub,
  SiGiphy,
  SiInstagram,
  SiSoundcloud,
  SiSpotify,
  SiTiktok,
  SiVimeo,
  SiWhatsapp,
  SiYoutube,
  SiGooglecalendar,
  SiCalendly,
} from "react-icons/si";
import type { BrandServiceProvider } from "@/lib/service-brand";

const brandIcons = {
  instagram: SiInstagram,
  whatsapp: SiWhatsapp,
  youtube: SiYoutube,
  spotify: SiSpotify,
  deezer: SiDeezer,
  soundcloud: SiSoundcloud,
  vimeo: SiVimeo,
  tiktok: SiTiktok,
  giphy: SiGiphy,
  google_calendar: SiGooglecalendar,
  calendly: SiCalendly,
  github: SiGithub,
} satisfies Record<BrandServiceProvider, typeof SiInstagram>;

interface ServiceBrandIconProps {
  provider: BrandServiceProvider;
  className?: string;
}

export const ServiceBrandIcon = ({ provider, className }: ServiceBrandIconProps) => {
  const Icon = brandIcons[provider];
  return (
    <span className={className} data-service-brand={provider} aria-hidden="true">
      <Icon className="h-full w-full" />
    </span>
  );
};
