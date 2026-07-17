import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackgroundLayer } from "./BackgroundLayer";

describe("BackgroundLayer", () => {
  it("renders uploaded background videos with resilient muted autoplay", () => {
    const html = renderToStaticMarkup(
      <BackgroundLayer
        config={{
          type: "video",
          mediaUrl: "/media/background.mp4",
          opacity: 0.8,
          blur: 0,
          overlayColor: "#000000",
          overlayOpacity: 0.2,
          brightness: 1,
          saturation: 1,
          contrast: 1,
          scale: 1,
          objectFit: "cover",
          glassmorphism: false,
        }}
      />,
    );

    expect(html).toContain("<video");
    expect(html).toContain("autoplay=\"\"");
    expect(html).toContain("muted=\"\"");
    expect(html).toContain("loop=\"\"");
    expect(html).toContain("playsinline=\"\"");
    expect(html).toContain("preload=\"auto\"");
  });
});
