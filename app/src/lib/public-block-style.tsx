import type { CSSProperties, ReactNode } from "react";
import type { LinkData } from "@/components/LinkCard";
import { resolvePublicImageUrl } from "@/lib/public-asset-readiness";
import { isSocialRowContent } from "@/lib/link-blocks";

const parseHexColor = (color?: string) => {
  if (!color) return null;
  const normalized = color.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const getReadableTextColor = (backgroundColor?: string) => {
  const rgb = parseHexColor(backgroundColor);
  if (!rgb) return undefined;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? "#111827" : "#f8fafc";
};

export const getPublicTextColor = (link: LinkData) =>
  link.textColor || getReadableTextColor(link.backgroundColor);

type PublicBlockCssProperties = CSSProperties & Record<`--${string}`, string>;

export const getPublicBlockAlignment = (link: LinkData) => link.alignment || (
  link.type === "social_row" || isSocialRowContent(link.content) ? "center" : "left"
);

export const getPublicBlockStyle = (link: LinkData): PublicBlockCssProperties => {
  const alignment = getPublicBlockAlignment(link);
  return {
    ...(link.backgroundColor ? {
      background: `color-mix(in srgb, ${link.backgroundColor} var(--content-card-opacity-percent, 100%), transparent)`,
      '--content-card-surface-tint': link.backgroundColor,
    } : {}),
    ...(getPublicTextColor(link) ? { color: getPublicTextColor(link) } : {}),
    fontFamily: link.titleFontFamily || "var(--font-card-title, inherit)",
    '--font-card-description-effective': link.descriptionFontFamily || "var(--font-card-description, inherit)",
    textAlign: alignment,
    '--public-block-align': { left: "start", center: "center", right: "end" }[alignment],
  };
};

export const getPublicBlockPadding = (size?: LinkData["size"]) => {
  if (size === "small") return "public-block-content p-3";
  if (size === "large") return "public-block-content p-5 sm:p-6";
  return "public-block-content p-4 sm:p-5";
};

export const getPublicIconSize = (size?: LinkData["size"]) => {
  if (size === "small") return "h-10 w-10";
  if (size === "large") return "h-14 w-14";
  return "h-12 w-12";
};

export const getPublicIconContent = (link: LinkData, fallback: ReactNode) => {
  if (!link.icon) return fallback;
  if (link.iconType === "image" || link.iconType === "svg") {
    const safeIcon = resolvePublicImageUrl(link.icon);
    return safeIcon
      ? <img src={safeIcon} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
      : fallback;
  }
  return <span className="text-xl leading-none">{link.icon}</span>;
};

export const getPublicAccentStyle = (link: LinkData): CSSProperties | undefined => (
  getPublicTextColor(link) ? { color: getPublicTextColor(link) } : undefined
);

export const getPublicButtonStyle = (link: LinkData): CSSProperties | undefined => {
  if (!link.textColor) return { fontFamily: "var(--font-button, inherit)" };
  return {
    fontFamily: "var(--font-button, inherit)",
    backgroundColor: link.textColor,
    color: link.backgroundColor || "hsl(var(--background))",
  };
};
