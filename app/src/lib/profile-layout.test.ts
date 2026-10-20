import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  normalizeVisibleProfileLayout,
  updateProfileLayoutAlignment,
  updateProfileLayoutItem,
  snapProfileLayoutRect,
} from "./profile-layout";

describe("profile layout", () => {
  it("snaps movement and resizing to the same 8px grid at fractional canvas widths", () => {
    const rect = { x: 7, y: 13, width: 47, height: 53 };
    const moved = snapProfileLayoutRect(rect, 'move', 300.5);
    const resized = snapProfileLayoutRect(rect, 'resize', 300.5);
    expect(moved.y).toBe(16);
    expect(Math.abs(moved.x / 100 * 300.5 - 24)).toBeLessThan(.02);
    expect(moved.width).toBe(rect.width);
    expect(resized.height).toBe(56);
    expect(Math.abs(resized.width / 100 * 300.5 - 144)).toBeLessThan(.02);
    expect(resized.x).toBe(rect.x);
  });
  it("supports continuous placement and two-dimensional resizing", () => {
    const moved = updateProfileLayoutItem(DEFAULT_PROFILE_LAYOUT, "name", {
      x: 34.25,
      y: 12,
      width: 28.5,
      height: 96,
    });

    expect(moved.positions.name).toEqual({ x: 34.25, y: 12, width: 28.5, height: 96 });
    expect(moved.positions.avatar).toEqual(DEFAULT_PROFILE_LAYOUT.positions.avatar);
  });

  it("keeps old two-column layouts readable when migrating them", () => {
    const migrated = normalizeProfileLayout({
      order: ["avatar", "name", "bio"],
      spans: { avatar: 1, name: 1, bio: 2 },
      gap: 20,
    });

    expect(migrated.positions.avatar).toMatchObject({ x: 0, width: 48 });
    expect(migrated.positions.name).toMatchObject({ x: 52, width: 48 });
    expect(migrated.positions.bio.y).toBeGreaterThan(migrated.positions.name.y);
  });

  it("stores explicit text alignment instead of inferring it from position", () => {
    const aligned = updateProfileLayoutAlignment(DEFAULT_PROFILE_LAYOUT, "location", "left");

    expect(aligned.alignments.location).toBe("left");
    expect(normalizeProfileLayout(aligned).alignments.location).toBe("left");
    expect(normalizeProfileLayout(undefined).alignments.work).toBe("center");
  });

  it("removes rows reserved by disabled default profile elements", () => {
    const compact = normalizeVisibleProfileLayout(undefined, ["name", "work", "location", "bio"]);

    expect(compact.positions.name.y).toBe(0);
    expect(compact.positions.work.y).toBe(80);
    expect(compact.positions.location.y).toBe(80);
    expect(compact.positions.bio.y).toBe(136);
    expect(compact.height).toBe(216);
  });
});
