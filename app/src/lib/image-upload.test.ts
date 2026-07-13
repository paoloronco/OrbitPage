import { describe, expect, it } from "vitest";
import { formatFileSize, imageSourceValidationError, MAX_SOURCE_IMAGE_BYTES } from "./image-upload";

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
  });

  it("formats byte limits for user-facing errors", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
