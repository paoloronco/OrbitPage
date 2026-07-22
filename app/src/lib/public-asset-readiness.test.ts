import { describe, expect, it, vi } from "vitest";
import { collectCriticalPublicImageUrls, isPublicImageReference, resolvePublicImageUrl, waitForCriticalPublicImages } from "./public-asset-readiness";

describe("public asset readiness", () => {
  it("collects unique profile, background and card media without emoji placeholders", () => {
    expect(collectCriticalPublicImageUrls({
      avatar: "https://media.example/avatar.webp",
      showAvatar: true,
      backgroundMedia: {
        type: "gif",
        mediaUrl: "https://media.example/background.gif",
        opacity: 1,
        blur: 0,
        overlayColor: "#000000",
        overlayOpacity: 0,
        brightness: 1,
        saturation: 1,
        contrast: 1,
        scale: 1,
        objectFit: "cover",
        glassmorphism: false,
      },
      links: [
        {
          id: "one",
          title: "One",
          description: "",
          url: "https://example.com",
          icon: "https://media.example/icon.webp",
          iconType: "image",
          coverImage: "https://media.example/cover.webp",
        },
        {
          id: "two",
          title: "Two",
          description: "",
          url: "https://example.com/two",
          icon: "P",
          iconType: "emoji",
          coverImage: "https://media.example/cover.webp",
        },
      ],
    })).toEqual([
      "https://media.example/avatar.webp",
      "https://media.example/background.gif",
      "https://media.example/icon.webp",
      "https://media.example/cover.webp",
    ]);
  });

  it("resolves relative public media through the active OrbitPage base path", () => {
    expect(resolvePublicImageUrl("/uploads/avatar.webp")).toContain("/uploads/avatar.webp");
    expect(resolvePublicImageUrl("javascript:alert(1)")).toBeNull();
  });

  it("does not treat semantic card icons as uploaded images", () => {
    expect(isPublicImageReference("instagram")).toBe(false);
    expect(isPublicImageReference("phone")).toBe(false);
    expect(isPublicImageReference("menu")).toBe(false);
    expect(isPublicImageReference("/uploads/icon.webp")).toBe(true);
    expect(isPublicImageReference("https://media.example/icon.svg")).toBe(true);

    expect(collectCriticalPublicImageUrls({
      links: [
        { id: "phone", title: "Call", description: "", url: "tel:+39000", icon: "phone" },
        { id: "social", title: "Instagram", description: "", url: "https://instagram.com/example", icon: "instagram" },
      ],
    })).toEqual([]);
  });

  it("never holds the page beyond the readiness timeout", async () => {
    vi.useFakeTimers();
    class PendingImage {
      complete = false;
      decode = vi.fn(() => new Promise<void>(() => undefined));
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";
    }
    vi.stubGlobal("Image", PendingImage);

    const ready = waitForCriticalPublicImages(["https://media.example/slow.webp"], 250);
    await vi.advanceTimersByTimeAsync(250);
    await expect(ready).resolves.toBeUndefined();

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
