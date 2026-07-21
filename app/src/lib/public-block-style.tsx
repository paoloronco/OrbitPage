import type { CSSProperties, ReactNode } from "react";
import type { LinkData } from "@/components/LinkCard";

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

export const getPublicBlockStyle = (link: LinkData): PublicBlockCssProperties => ({
  ...(link.backgroundColor ? {
    background: `color-mix(in srgb, ${link.backgroundColor} var(--content-card-opacity-percent, 100%), transparent)`,
    '--content-card-surface-tint': link.backgroundColor,
  } : {}),
  ...(getPublicTextColor(link) ? { color: getPublicTextColor(link) } : {}),
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

export const getPublicAccentStyle = (link: LinkData): CSSProperties | undefined => (
  getPublicTextColor(link) ? { color: getPublicTextColor(link) } : undefined
);

export const getPublicButtonStyle = (link: LinkData): CSSProperties | undefined => {
  if (!link.textColor) return undefined;
  return {
    backgroundColor: link.textColor,
    color: link.backgroundColor || "hsl(var(--background))",
  };
};
