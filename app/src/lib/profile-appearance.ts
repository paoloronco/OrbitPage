import type { CSSProperties } from "react";

export interface ProfileAppearance {
  cardBackgroundColor?: string;
  cardTextColor?: string;
  cardMutedColor?: string;
  cardBorderEnabled?: boolean;
  cardBorderColor?: string;
  accentColor?: string;
  avatarBorderEnabled?: boolean;
  avatarBorderColor?: string;
  avatarShape?: "round" | "square";
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
  if (appearance.cardBackgroundColor) style["--profile-card-background"] = appearance.cardBackgroundColor;
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
  if (!appearance) return {};
  const style: CSSProperties = {};
  if (appearance.avatarShape) style.borderRadius = appearance.avatarShape === "square" ? "12px" : "9999px";
  if (appearance.avatarBorderEnabled === false) {
    style.border = "none";
    style.boxShadow = "none";
  } else if (appearance.avatarBorderColor) {
    style.borderColor = appearance.avatarBorderColor;
    style.boxShadow = `0 8px 24px color-mix(in srgb, ${appearance.avatarBorderColor} 24%, transparent)`;
  }
  return style;
};
