import type { CSSProperties } from "react";
import type { CardSurfaceEffect } from "./theme";

export interface ProfileAppearance {
  surfaceEffect?: CardSurfaceEffect | "inherit";
  cardBackgroundColor?: string;
  cardTextColor?: string;
  cardMutedColor?: string;
  cardBorderEnabled?: boolean;
  cardBorderColor?: string;
  accentColor?: string;
  avatarBorderEnabled?: boolean;
  avatarBorderColor?: string;
  avatarShape?: "round" | "rounded" | "square";
  avatarSize?: number;
  profilePreset?: "creator" | "company" | "studio";
  profileDetails?: {
    primary?: string;
    secondary?: string;
  };
}

type ProfileCssProperties = CSSProperties & Record<`--profile-card-${string}`, string>;

const getReadableColor = (hex: string) => {
  const normalized = hex.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#f8fafc";
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.58 ? "#172033" : "#f8fafc";
};

export const getProfileAppearanceStyle = (appearance?: ProfileAppearance): ProfileCssProperties => {
  const style = {} as ProfileCssProperties;
  if (!appearance) return style;
  if (appearance.cardBackgroundColor) {
    style["--profile-card-background"] = `color-mix(in srgb, ${appearance.cardBackgroundColor} var(--profile-card-opacity-percent, 100%), transparent)`;
    style["--profile-card-surface-tint"] = appearance.cardBackgroundColor;
  }
  if (appearance.cardTextColor) style["--profile-card-foreground"] = appearance.cardTextColor;
  if (appearance.cardMutedColor) style["--profile-card-muted"] = appearance.cardMutedColor;
  if (appearance.cardBorderColor) style["--profile-card-border"] = appearance.cardBorderColor;
  if (appearance.accentColor) {
    style["--profile-card-accent"] = appearance.accentColor;
    style["--profile-card-accent-foreground"] = getReadableColor(appearance.accentColor);
  }
  if (appearance.cardBorderEnabled === false) style.border = "none";
  return style;
};

export const getProfileAvatarStyle = (appearance?: ProfileAppearance): CSSProperties => {
  const avatarSize = Math.min(192, Math.max(56, appearance?.avatarSize ?? 112));
  const style: CSSProperties = { width: `${avatarSize}px`, height: `${avatarSize}px` };
  if (!appearance) return style;
  if (appearance.avatarShape) {
    style.borderRadius = appearance.avatarShape === "square"
      ? "0px"
      : appearance.avatarShape === "rounded"
        ? "20px"
        : "9999px";
  }
  if (appearance.avatarBorderEnabled === false) {
    style.border = "none";
    style.boxShadow = "none";
  } else if (appearance.avatarBorderColor) {
    style.borderColor = appearance.avatarBorderColor;
    style.boxShadow = `0 8px 24px color-mix(in srgb, ${appearance.avatarBorderColor} 24%, transparent)`;
  }
  return style;
};
