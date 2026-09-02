import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  updateProfileLayoutItem,
} from "./profile-layout";

describe("profile layout", () => {
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
});
