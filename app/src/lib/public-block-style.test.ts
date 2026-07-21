import { describe, expect, it } from "vitest";

import { getPublicBlockStyle } from "./public-block-style";

describe("public block style", () => {
  it("preserves theme transparency for a custom block color", () => {
    const style = getPublicBlockStyle({
      id: "link-1",
      title: "Example",
      url: "https://example.com",
      type: "link",
      isActive: true,
      backgroundColor: "#123456",
    });

    expect(style.background).toBe("color-mix(in srgb, #123456 var(--content-card-opacity-percent, 100%), transparent)");
    expect(style["--content-card-surface-tint"]).toBe("#123456");
    expect(style.color).toBe("#f8fafc");
  });
});
