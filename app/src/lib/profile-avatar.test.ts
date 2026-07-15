import { describe, expect, it } from "vitest";
import { isBundledProfileAvatar, persistedProfileAvatar } from "./profile-avatar";

describe("bundled profile avatar", () => {
  it.each([
    "/src/assets/profile-avatar.jpg",
    "/assets/profile-avatar-DPd-s5ch.jpg",
    "https://orbitpage.com/orbitpage-runtime/assets/profile-avatar-DPd-s5ch.jpg",
    "http://localhost:3000/orbitpage-runtime/assets/profile-avatar-DPd-s5ch.jpg"
  ])("recognizes the UI fallback asset: %s", (value) => {
    expect(isBundledProfileAvatar(value)).toBe(true);
    expect(persistedProfileAvatar(value)).toBe("");
  });

  it("preserves uploaded tenant media", () => {
    const value = "/api/orbitpage/assets/tenants/example/profile-avatar-custom.jpg";
    expect(isBundledProfileAvatar(value)).toBe(false);
    expect(persistedProfileAvatar(value)).toBe(value);
  });
});

