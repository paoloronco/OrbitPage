import type { LinkData } from "@/components/LinkCard";
import { getInternalLinksData } from "./link-blocks";

const legacyShopItem = (link: LinkData) => {
  if (link.type !== "internal_links") return null;
  const items = getInternalLinksData(link.content).items;
  return items.length === 1 && items[0].kind === "shop" ? items[0] : null;
};

export const isNativeShopLink = (link: LinkData) =>
  link.systemKey === "shop" ||
  ((!link.type || link.type === "link") && link.url === "/shop") ||
  Boolean(legacyShopItem(link));

export const asNativeShopLink = (link: LinkData): LinkData => {
  const item = legacyShopItem(link);
  if (!item) return link;
  return {
    ...link,
    type: "link",
    title: link.title || item.label || "Shop",
    description: link.description || item.description || "",
    url: item.path,
    hideUrl: true,
    icon: link.icon || item.icon || undefined,
    iconType: link.iconType || (link.icon || item.icon ? "emoji" : undefined),
    content: undefined,
  };
};
