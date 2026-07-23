import type { CSSProperties } from "react";
import type { CardSurfaceEffect } from "./theme";

export interface ProfileAppearance {
  surfaceEffect?: CardSurfaceEffect | "inherit";
  surfaceOpacity?: number;
  surfaceBlur?: number;
  cardBackgroundColor?: string;
  cardTextColor?: string;
  cardMutedColor?: string;
  cardBorderEnabled?: boolean;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  cardRadius?: number;
  cardShadowColor?: string;
  cardShadowOpacity?: number;
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

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

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
  const surfaceOpacity = typeof appearance.surfaceOpacity === "number"
    ? clamp(appearance.surfaceOpacity, 0, 1)
    : undefined;
  const opacityPercent = surfaceOpacity === undefined
    ? "var(--profile-card-opacity-percent, 100%)"
    : `${Math.round(surfaceOpacity * 10_000) / 100}%`;
  if (appearance.cardBackgroundColor || surfaceOpacity !== undefined) {
    const surfaceColor = appearance.cardBackgroundColor || "var(--profile-card-surface-tint)";
    style["--profile-card-background"] = `color-mix(in srgb, ${surfaceColor} ${opacityPercent}, transparent)`;
  }
  if (appearance.cardBackgroundColor) {
    style["--profile-card-surface-tint"] = appearance.cardBackgroundColor;
  }
  if (surfaceOpacity !== undefined) {
    style["--profile-card-opacity-percent"] = opacityPercent;
    style["--profile-card-glass-highlight-percent"] = `${Math.round(surfaceOpacity * 34_00) / 100}%`;
    style["--profile-card-glass-tint-percent"] = `${Math.round(surfaceOpacity * 38_00) / 100}%`;
    style["--profile-card-glass-tint-soft-percent"] = `${Math.round(surfaceOpacity * 16_00) / 100}%`;
    style["--profile-card-glass-base-percent"] = `${Math.round(surfaceOpacity * 8_00) / 100}%`;
  }
  if (appearance.cardTextColor) style["--profile-card-foreground"] = appearance.cardTextColor;
  if (appearance.cardMutedColor) style["--profile-card-muted"] = appearance.cardMutedColor;
  if (appearance.cardBorderColor) {
    style["--profile-card-border"] = appearance.cardBorderColor;
    style["--profile-card-glass-border"] = appearance.cardBorderColor;
  }
  if (typeof appearance.surfaceBlur === "number") {
    style["--profile-card-blur"] = `${clamp(appearance.surfaceBlur, 0, 40)}px`;
  }
  if (typeof appearance.cardShadowOpacity === "number" || appearance.cardShadowColor) {
    const shadowOpacity = clamp(appearance.cardShadowOpacity ?? 0.14, 0, 0.6);
    if (appearance.cardShadowColor) style["--profile-card-shadow-color"] = appearance.cardShadowColor;
    style["--profile-card-shadow-opacity-percent"] = `${Math.round(shadowOpacity * 10_000) / 100}%`;
    style["--profile-card-shadow"] = "0 14px 38px color-mix(in srgb, var(--profile-card-shadow-color, #0f172a) var(--profile-card-shadow-opacity-percent, 14%), transparent)";
  }
  if (appearance.accentColor) {
    style["--profile-card-accent"] = appearance.accentColor;
    style["--profile-card-accent-foreground"] = getReadableColor(appearance.accentColor);
  }
  if (appearance.cardBorderEnabled === false) style.border = "none";
  if (appearance.cardBorderEnabled !== false && typeof appearance.cardBorderWidth === "number") {
    style.borderWidth = `${clamp(appearance.cardBorderWidth, 0, 6)}px`;
    style.borderStyle = "solid";
  }
  if (typeof appearance.cardRadius === "number") {
    style.borderRadius = `${clamp(appearance.cardRadius, 0, 40)}px`;
  }
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
