import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicInternalLinksCard } from "./PublicInternalLinksCard";

describe("PublicInternalLinksCard", () => {
  it("renders side-by-side internal destinations with supporting copy", () => {
    const html = renderToStaticMarkup(<PublicInternalLinksCard link={{
      id: "navigation",
      type: "internal_links",
      title: "Explore",
      description: "Choose a destination",
      url: "",
      content: JSON.stringify({
        items: [
          { id: "menu", kind: "menu", path: "/menu", label: "Menu", description: "Food and drinks" },
          { id: "shop", kind: "shop", path: "/shop", label: "Shop", description: "Products" },
        ],
        layout: "grid",
        columns: 2,
        itemStyle: "outline",
        showDescriptions: true,
        showIcons: true,
      }),
    }} />);

    expect(html).toContain("public-internal-links__items--grid");
    expect(html).toContain('data-item-style="outline"');
    expect(html).toContain('href="/menu"');
    expect(html).toContain('href="/shop"');
    expect(html).toContain("Food and drinks");
  });

  it("renders compact buttons without descriptions", () => {
    const html = renderToStaticMarkup(<PublicInternalLinksCard link={{
      id: "buttons",
      type: "internal_links",
      title: "",
      description: "",
      url: "",
      content: JSON.stringify({
        items: [{ id: "page", kind: "page", path: "/services", label: "Services", description: "Long supporting copy" }],
        layout: "buttons",
        columns: 2,
        itemStyle: "filled",
        showDescriptions: true,
        showIcons: false,
      }),
    }} />);

    expect(html).toContain("public-internal-links__items--buttons");
    expect(html).toContain('href="/services"');
    expect(html).toContain("Services");
    expect(html).not.toContain("Long supporting copy");
  });
});
