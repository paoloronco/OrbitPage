import { describe, expect, it } from "vitest";

import { alignCardLayoutRect, normalizeCardLayout, PROFILE_CARD_LAYOUT_ID, updateCardContentLayoutItem, updateCardLayoutItem } from "./card-layout";

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

  it("adds a movable profile before existing cards without overlapping them", () => {
    const layout = normalizeCardLayout({
      positions: { large: { x: 0, y: 0, width: 100, height: 120 } },
      height: 120,
    }, [
      { id: "profile", type: "profile", prepend: true, defaultRect: { x: 25, width: 50, height: 456 } },
      ...cards,
    ], "desktop");

    expect(layout.positions.profile).toEqual({ x: 25, y: 0, width: 50, height: 456 });
    expect(layout.positions.large).toMatchObject({ y: 480 });
  });

  it("migrates the legacy reserved profile key without shifting saved cards", () => {
    const layout = normalizeCardLayout({
      positions: {
        __orbitpage_profile__: { x: 12, y: 0, width: 40, height: 456 },
        large: { x: 56, y: 0, width: 44, height: 120 },
      },
      height: 456,
    }, [
      { id: PROFILE_CARD_LAYOUT_ID, type: "profile", prepend: true, defaultRect: { x: 25, width: 50, height: 456 } },
      ...cards,
    ], "desktop");

    expect(layout.positions[PROFILE_CARD_LAYOUT_ID]).toEqual({ x: 12, y: 0, width: 40, height: 456 });
    expect(layout.positions.large).toMatchObject({ x: 56, y: 0 });
    expect(layout.positions).not.toHaveProperty("__orbitpage_profile__");
  });

  it("offers a small alignment snap without resizing freely positioned cards", () => {
    const aligned = alignCardLayoutRect(
      { large: { x: 0, y: 20, width: 42, height: 120 }, compact: { x: 56, y: 132, width: 44, height: 92 } },
      224,
      "compact",
      { x: 55.75, y: 21.5, width: 44, height: 92 },
      "move",
      1,
      2,
    );

    expect(aligned.rect).toMatchObject({ x: 56, y: 20, width: 44 });
    expect(aligned.guides).toEqual({ x: 100, y: 20 });
  });
});
