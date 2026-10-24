import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  normalizeVisibleProfileLayout,
  fitVisibleProfileLayout,
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

  it("preserves the rows and order of legacy grids when removing hidden items", () => {
    const migrated = normalizeVisibleProfileLayout({
      order: ["name", "avatar", "location", "work", "socials"],
      spans: { avatar: 1, name: 1, work: 1, location: 1 }, gap: 20,
    }, ["name", "avatar", "work", "location"]);
    expect(migrated.positions.name.y).toBe(0);
    expect(migrated.positions.avatar.y).toBe(0);
    expect(migrated.positions.location).toMatchObject({ x: 0, y: 132 });
    expect(migrated.positions.work).toMatchObject({ x: 52, y: 132 });
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

  it("repairs a saved detail row as a unit when one column grows or overlaps an earlier element", () => {
    const saved = normalizeVisibleProfileLayout({ positions: {
      name: { x: 55, y: 0, width: 45, height: 64 },
      work: { x: 0, y: 80, width: 45, height: 40 },
      location: { x: 55, y: 80, width: 45, height: 72 },
      socials: { x: 0, y: 168, width: 45, height: 48 },
    } }, ["name", "work", "location", "socials"]);
    const before = structuredClone(saved);
    for (const nameHeight of [64, 96]) {
      const fitted = fitVisibleProfileLayout(saved, ["name", "work", "location", "socials"], { name: nameHeight, location: 120 });
      expect(fitted.positions.work.y).toBe(fitted.positions.location.y);
      expect(fitted.positions.location.y).toBeGreaterThanOrEqual(nameHeight);
      expect(fitted.positions.socials.y).toBeGreaterThanOrEqual(fitted.positions.location.y + 120 + 16);
      expect(fitted.positions.work).toMatchObject({ x: 0, width: 45, height: 40 });
      expect(fitted.positions.location).toMatchObject({ x: 55, width: 45, height: 120 });
    }
    expect(fitVisibleProfileLayout(saved, ["name", "work", "location", "socials"], {}).positions).toEqual(saved.positions);
    expect(saved).toEqual(before);
  });

  it("preserves valid manual offsets and fits a single visible detail independently", () => {
    const saved = normalizeVisibleProfileLayout({ positions: {
      work: { x: 0, y: 80, width: 45, height: 40 },
      location: { x: 55, y: 81, width: 45, height: 40 },
    }, alignments: { work: "right", location: "left" } }, ["work", "location"]);
    expect(fitVisibleProfileLayout(saved, ["work", "location"], {}).positions).toEqual(saved.positions);
    expect(fitVisibleProfileLayout(saved, ["work", "location"], {}).alignments).toEqual(saved.alignments);
    const fitted = fitVisibleProfileLayout(saved, ["work"], { location: 400 });
    expect(fitted.positions.work).toEqual(saved.positions.work);
    expect(fitted.positions.location).toEqual(saved.positions.location);
  });

  it("preserves an element deliberately placed beneath the shorter detail column", () => {
    const saved = normalizeVisibleProfileLayout({ positions: {
      work: { x: 0, y: 80, width: 45, height: 40 },
      location: { x: 55, y: 80, width: 45, height: 160 },
      socials: { x: 0, y: 136, width: 45, height: 48 },
    } }, ["work", "location", "socials"]);
    expect(fitVisibleProfileLayout(saved, ["work", "location", "socials"], {}).positions).toEqual(saved.positions);
  });
});
