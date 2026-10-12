import { describe, expect, it } from "vitest";

import { alignCardLayoutRect, fitCardLayoutHeights, moveMobileCard, normalizeCardLayout, preventCardLayoutOverlap, PROFILE_CARD_LAYOUT_ID, updateCardLayoutItem } from "./card-layout";

const cards = [
  { id: "large", type: "link", size: "large" },
  { id: "compact", type: "link", size: "small" },
];

describe("responsive card layout", () => {
  it("allows free widths on both viewports within readable bounds", () => {
    const mobileLarge = updateCardLayoutItem(undefined, cards, "mobile", "large", { x: 35, y: 40, width: 50, height: 140 });
    const mobileCompact = updateCardLayoutItem(mobileLarge, cards, "mobile", "compact", { x: 52, y: 40, width: 48, height: 76 });
    const desktopLarge = updateCardLayoutItem(undefined, cards, "desktop", "large", { x: 35, y: 40, width: 50, height: 140 });

    expect(mobileLarge.positions.large).toMatchObject({ x: 35, width: 50 });
    expect(mobileCompact.positions.compact).toMatchObject({ x: 52, width: 48 });
    expect(desktopLarge.positions.large).toMatchObject({ x: 35, width: 50 });
  });

  it("moves a mobile card vertically without moving the profile card", () => {
    const layout = {
      positions: {
        [PROFILE_CARD_LAYOUT_ID]: { x: 0, y: 0, width: 100, height: 200 },
        large: { x: 0, y: 224, width: 100, height: 120 },
        compact: { x: 0, y: 368, width: 100, height: 92 },
      },
      height: 460,
    };
    const sources = [{ id: PROFILE_CARD_LAYOUT_ID, type: "profile", prepend: true }, ...cards];
    const moved = moveMobileCard(layout, sources, ["large", "compact"], "compact", -1);
    expect(moved?.positions[PROFILE_CARD_LAYOUT_ID]).toEqual(layout.positions[PROFILE_CARD_LAYOUT_ID]);
    expect(moved?.positions.compact.y).toBe(224);
    expect(moved?.positions.large.y).toBe(340);
    expect(moveMobileCard(layout, sources, ["large", "compact"], "large", -1)).toBeNull();
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

  it("rejects overlap while still allowing movement on a free axis", () => {
    const positions = {
      left: { x: 0, y: 0, width: 50, height: 120 },
      right: { x: 50, y: 140, width: 50, height: 120 },
    };

    expect(preventCardLayoutOverlap(positions, "right", { x: 25, y: 60, width: 50, height: 120 }, positions.right)).toEqual({ x: 25, y: 140, width: 50, height: 120 });
    expect(preventCardLayoutOverlap(positions, "right", { x: 25, y: 280, width: 50, height: 120 }, positions.right)).toEqual({ x: 25, y: 280, width: 50, height: 120 });
  });

  it("keeps all other cards stationary even when dragging across them", () => {
    const layout = {
      positions: {
        large: { x: 0, y: 0, width: 50, height: 120 },
        compact: { x: 50, y: 0, width: 50, height: 92 },
      },
      height: 120,
    };

    const updated = updateCardLayoutItem(layout, cards, "desktop", "compact", { x: 25, y: 0, width: 50, height: 92 });
    expect(updated.positions.compact).toEqual({ x: 25, y: 0, width: 50, height: 92 });
    expect(updated.positions.large).toEqual({ x: 0, y: 0, width: 50, height: 120 });
  });

  it("does not resize visual cards below their useful default height", () => {
    const imageCard = [{ id: "photo", type: "image" }];

    expect(updateCardLayoutItem(undefined, imageCard, "desktop", "photo", { x: 0, y: 0, width: 50, height: 48 }).positions.photo.height)
      .toBe(220);
  });
  it("keeps fractional widths and coordinates without preset snapping", () => {
    const rect = { x: 12.34, y: 57, width: 37.68, height: 173 };
    expect(updateCardLayoutItem(undefined, cards, "desktop", "large", rect).positions.large).toEqual(rect);
    expect(updateCardLayoutItem(undefined, cards, "mobile", "large", { ...rect, x: 90, width: 12 }).positions.large).toMatchObject({ x: 56, width: 44 });
  });

  it("fits wrapped content without losing gaps or moving independent columns", () => {
    const layout = { height: 300, positions: {
      first: { x: 0, y: 0, width: 50, height: 100 },
      below: { x: 0, y: 124, width: 50, height: 100 },
      side: { x: 60, y: 124, width: 40, height: 100 },
      overlap: { x: 0, y: 40, width: 50, height: 50 },
    } };
    const fitted = fitCardLayoutHeights(layout, { first: 250, below: 140 });
    expect(fitted.positions.below).toMatchObject({ y: 274, height: 140 });
    expect(fitted.positions.side).toEqual(layout.positions.side);
    expect(fitted.positions.overlap).toEqual(layout.positions.overlap);
    expect(fitted.height).toBe(414);
    expect(fitCardLayoutHeights(layout, { first: 250 }, false).positions.below).toEqual(layout.positions.below);
    expect(fitCardLayoutHeights(layout, {}).positions).toEqual(layout.positions);
  });

  it("preserves legacy text offsets as data without changing them when a card moves", () => {
    const contents = { large: { positions: { title: { x: 30, y: 500, width: 50, height: 24 } } } };
    expect(updateCardLayoutItem({ contents }, cards, "desktop", "large", { x: 3, y: 8, width: 70, height: 160 }).contents).toEqual(contents);
  });

});
