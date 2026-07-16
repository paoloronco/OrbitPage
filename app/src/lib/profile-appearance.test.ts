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
});
