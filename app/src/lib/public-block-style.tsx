import type { CSSProperties, ReactNode } from "react";
import type { LinkData } from "@/components/LinkCard";

export const getPublicBlockStyle = (link: LinkData): CSSProperties => ({
  ...(link.backgroundColor ? { backgroundColor: link.backgroundColor } : {}),
  ...(link.textColor ? { color: link.textColor } : {}),
  ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
  ...(link.alignment ? { textAlign: link.alignment } : {}),
});

export const getPublicBlockPadding = (size?: LinkData["size"]) => {
  if (size === "small") return "p-3";
  if (size === "large") return "p-5 sm:p-6";
  return "p-4 sm:p-5";
};

export const getPublicBlockGap = (size?: LinkData["size"]) => {
  if (size === "small") return "gap-3";
  if (size === "large") return "gap-5";
  return "gap-4";
};

export const getPublicIconSize = (size?: LinkData["size"]) => {
  if (size === "small") return "h-10 w-10";
  if (size === "large") return "h-14 w-14";
  return "h-12 w-12";
};

export const getPublicIconContent = (link: LinkData, fallback: ReactNode) => {
  if (!link.icon) return fallback;
  if (link.iconType === "image" || link.iconType === "svg") {
    return <img src={link.icon} alt="" className="h-full w-full rounded-lg object-cover" loading="lazy" decoding="async" />;
  }
  return <span className="text-xl leading-none">{link.icon}</span>;
};
