import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("renders a controlled, labelled switch with its current state", () => {
    const html = renderToStaticMarkup(
      <Switch
        aria-label="Show profile image"
        checked
        onCheckedChange={() => undefined}
      />,
    );

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Show profile image"');
    expect(html).toContain("data-state=\"checked\"");
    expect(html).toContain("data-[state=checked]:!translate-x-[18px]");
  });

  it("supports the compact size and disabled state", () => {
    const html = renderToStaticMarkup(
      <Switch
        aria-label="Optional setting"
        checked={false}
        disabled
        onCheckedChange={() => undefined}
        size="small"
      />,
    );

    expect(html).toContain("!h-6 !min-h-6 !w-10 !min-w-10");
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("disabled");
  });
});
