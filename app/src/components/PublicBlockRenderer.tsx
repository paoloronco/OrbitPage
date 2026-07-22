import type { LinkData } from "./LinkCard";
import { PublicCalloutCard } from "./PublicCalloutCard";
import { PublicContactCard } from "./PublicContactCard";
import { PublicEventCard } from "./PublicEventCard";
import { PublicEmbedCard } from "./PublicEmbedCard";
import { PublicHeadingCard } from "./PublicHeadingCard";
import { PublicImageCard } from "./PublicImageCard";
import { PublicLinkCard } from "./PublicLinkCard";
import { PublicMapCard } from "./PublicMapCard";
import { PublicMenuCard } from "./PublicMenuCard";
import { PublicSeparatorCard } from "./PublicSeparatorCard";
import { PublicSocialRowCard } from "./PublicSocialRowCard";
import { PublicTextCard } from "./PublicTextCard";
import { PublicVideoCard } from "./PublicVideoCard";
import { isNativeMenuLink } from "@/lib/native-menu-link";
import { isSocialRowContent } from "@/lib/link-blocks";

interface PublicBlockRendererProps {
  link: LinkData;
}

export const PublicBlockRenderer = ({ link }: PublicBlockRendererProps) => {
  if (isNativeMenuLink(link)) return <PublicMenuCard link={link} />;
  if (link.type === "separator") return <PublicSeparatorCard link={link} />;
  if (link.type === "text") return <PublicTextCard link={link} />;
  if (link.type === "heading") return <PublicHeadingCard link={link} />;
  if (link.type === "image") return <PublicImageCard link={link} />;
  if (link.type === "video") return <PublicVideoCard link={link} />;
  if (link.type === "contact") return <PublicContactCard link={link} />;
  if (link.type === "social_row" || isSocialRowContent(link.content)) return <PublicSocialRowCard link={link} />;
  if (link.type === "callout") return <PublicCalloutCard link={link} />;
  if (link.type === "map") return <PublicMapCard link={link} />;
  if (link.type === "event") return <PublicEventCard link={link} />;
  if (link.type === "embed") return <PublicEmbedCard link={link} />;
  return <PublicLinkCard link={link} />;
};
