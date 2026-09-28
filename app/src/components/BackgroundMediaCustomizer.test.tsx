import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultBackgroundMedia } from "@/lib/theme";
import { RASTER_IMAGE_ACCEPT } from "@/lib/media-validation";
import { BackgroundMediaCustomizer } from "./BackgroundMediaCustomizer";

describe("BackgroundMediaCustomizer", () => {
  it("offers raster images as page backgrounds", () => {
    const html = renderToStaticMarkup(
      <BackgroundMediaCustomizer
        config={{ ...defaultBackgroundMedia, type: "gif" }}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Image File");
    expect(html).toContain(`accept="${RASTER_IMAGE_ACCEPT}"`);
    expect(html).toContain("Upload PNG, JPG, WebP, AVIF or GIF");
  });
});
