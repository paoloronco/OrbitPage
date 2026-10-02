import { describe, expect, it } from "vitest";

import { alignCardLayoutRect, normalizeCardContentLayout, normalizeCardLayout, preventCardLayoutOverlap, PROFILE_CARD_LAYOUT_ID, reflowCardLayoutPositions, snapCardLayoutSize, stepCardLayoutWidth, updateCardContentLayoutItem, updateCardLayoutItem } from "./card-layout";

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
      y: 70,
      width: 62,
      height: 32,
    });

    expect(updated.contents?.large.positions?.title).toEqual({ x: 4, y: 70, width: 62, height: 32 });
    expect(normalizeCardLayout(updated, cards, "desktop").contents?.large).toBeDefined();
  });

  it("centers every default card text region", () => {
    const layout = normalizeCardContentLayout();

    for (const item of ["title", "description", "url"] as const) {
      expect(layout.positions[item].x + layout.positions[item].width / 2).toBe(50);
    }
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

  it("snaps card sizes to reusable presets", () => {
    expect(snapCardLayoutSize({ x: 0, y: 0, width: 47, height: 137 })).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 144,
    });
  });

  it("keeps the actual default width among resize stops", () => {
    const initial = { x: 30.5, y: 0, width: 39, height: 100 };
    expect(stepCardLayoutWidth(39, 1, 38.89)).toBe(40);
    expect(stepCardLayoutWidth(40, -1, 38.89)).toBe(39);
    expect(snapCardLayoutSize({ ...initial, width: 39 }, 38.89).width).toBe(39);
  });

  it("rejects overlap while still allowing movement on a free axis", () => {
    const positions = {
      left: { x: 0, y: 0, width: 50, height: 120 },
      right: { x: 50, y: 140, width: 50, height: 120 },
    };

    expect(preventCardLayoutOverlap(positions, "right", { x: 25, y: 60, width: 50, height: 120 }, positions.right)).toEqual({ x: 25, y: 140, width: 50, height: 120 });
    expect(preventCardLayoutOverlap(positions, "right", { x: 25, y: 280, width: 50, height: 120 }, positions.right)).toEqual({ x: 25, y: 280, width: 50, height: 120 });
  });

  it("moves occupied cards below the updated card", () => {
    const layout = {
      positions: {
        large: { x: 0, y: 0, width: 50, height: 120 },
        compact: { x: 50, y: 0, width: 50, height: 92 },
      },
      height: 120,
    };

    const updated = updateCardLayoutItem(layout, cards, "desktop", "compact", { x: 25, y: 0, width: 50, height: 92 });
    expect(updated.positions.compact).toEqual({ x: 25, y: 0, width: 50, height: 92 });
    expect(updated.positions.large).toEqual({ x: 0, y: 116, width: 50, height: 120 });
    expect(updateCardLayoutItem(layout, cards, "desktop", "compact", { x: 25, y: 0, width: 50, height: 92 }, true).positions.compact)
      .toEqual({ x: 25, y: 0, width: 50, height: 92 });
  });

  it("reflows vertical collisions as a cascade while preserving free columns", () => {
    const positions = {
      top: { x: 0, y: 0, width: 100, height: 100 },
      middle: { x: 0, y: 124, width: 100, height: 100 },
      moved: { x: 0, y: 248, width: 100, height: 100 },
      side: { x: 75, y: 0, width: 25, height: 100 },
    };

    expect(reflowCardLayoutPositions(positions, "moved", { ...positions.moved, x: 0, y: 0, width: 75 })).toEqual({
      moved: { x: 0, y: 0, width: 75, height: 100 },
      top: { x: 0, y: 124, width: 100, height: 100 },
      side: { x: 75, y: 0, width: 25, height: 100 },
      middle: { x: 0, y: 248, width: 100, height: 100 },
    });
  });

  it("does not resize visual cards below their useful default height", () => {
    const imageCard = [{ id: "photo", type: "image" }];

    expect(updateCardLayoutItem(undefined, imageCard, "desktop", "photo", { x: 0, y: 0, width: 50, height: 48 }).positions.photo.height)
      .toBe(220);
  });
});
