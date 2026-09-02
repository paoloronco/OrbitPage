import { describe, expect, it } from "vitest";
import {
  moveProfileLayoutItem,
  normalizeProfileLayout,
  reorderProfileLayout,
  resizeProfileLayoutItem,
} from "./profile-layout";

describe("profile layout", () => {
  it("normalizes, reorders and resizes the responsive profile grid", () => {
    const normalized = normalizeProfileLayout({ order: ["bio", "name"], spans: { name: 1 }, gap: 99 });
    expect(normalized.order).toEqual(["bio", "name", "avatar", "work", "location", "socials"]);
    expect(normalized.gap).toBe(32);
    expect(reorderProfileLayout(normalized, "socials", "name").order.slice(0, 3)).toEqual(["bio", "socials", "name"]);
    expect(moveProfileLayoutItem(normalized, "bio", 1).order.slice(0, 2)).toEqual(["name", "bio"]);
    expect(resizeProfileLayoutItem(normalized, "bio", 1).spans.bio).toBe(1);
  });
});
