import { describe, expect, it } from "vitest";

import { normalizeCardLayout, updateCardContentLayoutItem, updateCardLayoutItem } from "./card-layout";

const cards = [
  { id: "large", type: "link", size: "large" },
  { id: "compact", type: "link", size: "small" },
];

describe("responsive card layout", () => {
  it("keeps normal mobile cards vertical while allowing compact cards and desktop cards to use horizontal space", () => {
    const mobileLarge = updateCardLayoutItem(undefined, cards, "mobile", "large", { x: 35, y: 40, width: 50, height: 140 });
    const mobileCompact = updateCardLayoutItem(mobileLarge, cards, "mobile", "compact", { x: 52, y: 40, width: 48, height: 76 });
    const desktopLarge = updateCardLayoutItem(undefined, cards, "desktop", "large", { x: 35, y: 40, width: 50, height: 140 });

    expect(mobileLarge.positions.large).toMatchObject({ x: 0, width: 100 });
    expect(mobileCompact.positions.compact).toMatchObject({ x: 52, width: 48 });
    expect(desktopLarge.positions.large).toMatchObject({ x: 35, width: 50 });
  });

  it("stores free positioning for elements inside a card", () => {
    const updated = updateCardContentLayoutItem(undefined, cards, "desktop", "large", "title", {
      x: 4,
      y: 38,
      width: 62,
      height: 32,
    });

    expect(updated.contents?.large.positions?.title).toEqual({ x: 4, y: 38, width: 62, height: 32 });
    expect(normalizeCardLayout(updated, cards, "desktop").contents?.large).toBeDefined();
  });
});
