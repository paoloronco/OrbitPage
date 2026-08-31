import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFileSize, imageSourceValidationError, MAX_SOURCE_IMAGE_BYTES, optimizeImageForUpload } from "./image-upload";

afterEach(() => vi.unstubAllGlobals());

function imageEnvironment(encodedTypes: string[]) {
  class TestImage {
    naturalHeight = 600;
    naturalWidth = 800;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  const toBlob = vi.fn((callback: BlobCallback, type: string) => {
    const actualType = encodedTypes.shift() || "image/png";
    callback(new Blob([type], { type: actualType }));
  });
  vi.stubGlobal("Image", TestImage);
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({ drawImage: vi.fn() }),
      height: 0,
      toBlob,
      width: 0,
    }),
  });
  return toBlob;
}

describe("image upload validation", () => {
  it("rejects oversized images before decoding", () => {
    const error = imageSourceValidationError({ name: "test.jpg", type: "image/jpeg", size: MAX_SOURCE_IMAGE_BYTES + 1 });
    expect(error).toContain("Choose a file up to 10 MB");
  });

  it("rejects unsupported files", () => {
    expect(imageSourceValidationError({ name: "test.svg", type: "image/svg+xml", size: 100 })).toContain("Unsupported image type");
  });

  it("accepts a normal raster image", () => {
    expect(imageSourceValidationError({ name: "cover.png", type: "image/png", size: 800_000 })).toBeNull();
    expect(imageSourceValidationError({ name: "cover.avif", type: "image/avif", size: 800_000 })).toBeNull();
  });

  it("prefers AVIF and falls back to WebP when the canvas encoder lacks AVIF", async () => {
    imageEnvironment(["image/avif"]);
    const avif = await optimizeImageForUpload(new File(["source"], "cover.png", { type: "image/png" }), "cover");
    expect(avif).toMatchObject({ name: "cover.avif", type: "image/avif" });

    const toBlob = imageEnvironment(["image/png", "image/webp"]);
    const webp = await optimizeImageForUpload(new File(["source"], "cover.png", { type: "image/png" }), "cover");
    expect(webp).toMatchObject({ name: "cover.webp", type: "image/webp" });
    expect(toBlob).toHaveBeenCalledTimes(2);
  });

  it("formats byte limits for user-facing errors", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
