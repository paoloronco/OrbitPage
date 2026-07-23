import { describe, expect, it } from "vitest";

import { getProfileAppearanceStyle, getProfileAvatarStyle } from "./profile-appearance";

describe("profile appearance", () => {
  it.each([
    ["round", "9999px"],
    ["rounded", "20px"],
    ["square", "0px"],
  ] as const)("maps the %s avatar shape to a stable radius", (shape, radius) => {
    expect(getProfileAvatarStyle({ avatarShape: shape }).borderRadius).toBe(radius);
  });

  it("clamps avatar sizing and can remove the profile card border", () => {
    expect(getProfileAvatarStyle({ avatarSize: 400 }).width).toBe("192px");
    expect(getProfileAvatarStyle({ avatarSize: 12 }).height).toBe("56px");
    expect(getProfileAppearanceStyle({ cardBorderEnabled: false }).border).toBe("none");
  });

  it("preserves theme transparency for a custom profile card color", () => {
    const style = getProfileAppearanceStyle({ cardBackgroundColor: "#123456" });
    expect(style["--profile-card-background"])
      .toBe("color-mix(in srgb, #123456 var(--profile-card-opacity-percent, 100%), transparent)");
    expect(style["--profile-card-surface-tint"]).toBe("#123456");
  });

  it("applies independent profile-card surface, border, radius, blur and shadow controls", () => {
    const style = getProfileAppearanceStyle({
      surfaceOpacity: 0.42,
      surfaceBlur: 18,
      cardBorderWidth: 3,
      cardBorderColor: "#334455",
      cardRadius: 24,
      cardShadowColor: "#112233",
      cardShadowOpacity: 0.25,
    });

    expect(style["--profile-card-background"])
      .toBe("color-mix(in srgb, var(--profile-card-surface-tint) 42%, transparent)");
    expect(style["--profile-card-opacity-percent"]).toBe("42%");
    expect(style["--profile-card-blur"]).toBe("18px");
    expect(style["--profile-card-shadow-color"]).toBe("#112233");
    expect(style["--profile-card-shadow-opacity-percent"]).toBe("25%");
    expect(style["--profile-card-glass-border"]).toBe("#334455");
    expect(style.borderWidth).toBe("3px");
    expect(style.borderRadius).toBe("24px");
  });

  it("clamps malformed numeric appearance values before rendering", () => {
    const style = getProfileAppearanceStyle({
      surfaceOpacity: 5,
      surfaceBlur: -20,
      cardBorderWidth: 40,
      cardRadius: -2,
      cardShadowOpacity: 2,
    });

    expect(style["--profile-card-opacity-percent"]).toBe("100%");
    expect(style["--profile-card-blur"]).toBe("0px");
    expect(style["--profile-card-shadow-opacity-percent"]).toBe("60%");
    expect(style.borderWidth).toBe("6px");
    expect(style.borderRadius).toBe("0px");
  });
});
