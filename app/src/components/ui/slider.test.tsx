import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Slider } from "./slider";

describe("Slider", () => {
  it("renders a labelled material-style slider with a formatted value label", () => {
    const html = renderToStaticMarkup(
      <Slider
        aria-label="Card radius"
        max={32}
        min={0}
        value={[18]}
        valueLabelFormat={(value) => `${value}px`}
      />,
    );

    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-label="Card radius"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="32"');
    expect(html).toContain("18px");
    expect(html).toContain("bg-[#3568f4]");
  });

  it("can hide the visual value label without removing slider semantics", () => {
    const html = renderToStaticMarkup(
      <Slider aria-label="Opacity" value={[70]} valueLabelDisplay="off" />,
    );

    expect(html).toContain('role="slider"');
    expect(html).not.toContain('aria-hidden="true"');
  });
});
