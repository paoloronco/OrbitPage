import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Comparison, ComparisonHandle, ComparisonItem } from "./comparison";

describe("Comparison", () => {
  it("exposes an accessible keyboard slider and keeps both visual layers inert", () => {
    const html = renderToStaticMarkup(
      <Comparison defaultValue={36}>
        <ComparisonItem position="left">Before</ComparisonItem>
        <ComparisonItem position="right">After</ComparisonItem>
        <ComparisonHandle label="Compare saved and draft themes" beforeLabel="Saved" afterLabel="Draft" />
      </Comparison>,
    );

    expect(html).toContain('data-comparison-value="36"');
    expect(html).toContain('type="range"');
    expect(html).toContain('value="36"');
    expect(html).toContain('data-comparison-handle=""');
    expect(html).toContain("!h-full !min-h-full");
    expect(html).toContain('aria-label="Compare saved and draft themes"');
    expect(html).toContain('aria-valuetext="Saved 36%, Draft 64%"');
    expect(html.match(/inert=""/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
