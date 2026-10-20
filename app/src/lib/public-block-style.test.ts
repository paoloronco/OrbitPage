import { describe, expect, it } from "vitest";

import { getPublicBlockPadding, getPublicBlockStyle } from "./public-block-style";

describe("public block style", () => {
  it.each([
    [undefined, "left", "start"], ["left", "left", "start"], ["center", "center", "center"], ["right", "right", "end"],
  ] as const)("shares the %s alignment across text and icon rows", (alignment, textAlign, itemsAlign) => {
    expect(getPublicBlockStyle({ id: "aligned", title: "Title", url: "", description: "", alignment }))
      .toMatchObject({ textAlign, "--public-block-align": itemsAlign });
    for (const size of ["small", "medium", "large"] as const) expect(getPublicBlockPadding(size)).toContain("public-block-content");
  });
  it.each(["social_row", "link"] as const)("preserves the centered default for %s social docks", type => {
    const link = { id: "dock", title: "", description: "", url: "", type, content: JSON.stringify({ items: [{ platform: "github", label: "GitHub", url: "fictional" }], layout: "icons" }) };
    expect(getPublicBlockStyle(link)).toMatchObject({ textAlign: "center", "--public-block-align": "center" });
    expect(getPublicBlockStyle({ ...link, alignment: "left" })).toMatchObject({ textAlign: "left", "--public-block-align": "start" });
  });
  it("preserves theme transparency for a custom block color", () => {
    const style = getPublicBlockStyle({
      id: "link-1",
      title: "Example",
      description: "",
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
