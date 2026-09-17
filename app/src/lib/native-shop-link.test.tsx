import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicBlockRenderer } from "@/components/PublicBlockRenderer";
import type { LinkData } from "@/components/LinkCard";
import { asNativeShopLink, isNativeShopLink } from "./native-shop-link";

describe("native Shop card", () => {
  it("renders an existing one-destination Shop block as one editable card", () => {
    const legacy: LinkData = {
      id: "shop-card",
      type: "internal_links",
      title: "My store",
      description: "Browse the catalog",
      url: "",
      content: JSON.stringify({ items: [{ id: "shop", kind: "shop", path: "/shop", label: "Shop", description: "Browse the catalog" }], layout: "grid" }),
    };

    expect(isNativeShopLink(legacy)).toBe(true);
    expect(asNativeShopLink(legacy)).toMatchObject({ type: "link", title: "My store", url: "/shop", hideUrl: true });
    const html = renderToStaticMarkup(<PublicBlockRenderer link={legacy} />);
    expect(html).toContain("My store");
    expect(html).toContain("Browse the catalog");
    expect(html).not.toContain("public-internal-link");
    expect(html).not.toContain("public-internal-links__items--grid");
  });

  it("keeps multi-destination navigation as a navigation block", () => {
    const navigation: LinkData = {
      id: "navigation",
      type: "internal_links",
      title: "Explore",
      description: "",
      url: "",
      content: JSON.stringify({ items: [
        { id: "shop", kind: "shop", path: "/shop", label: "Shop" },
        { id: "menu", kind: "menu", path: "/menu", label: "Menu" },
      ] }),
    };

    expect(isNativeShopLink(navigation)).toBe(false);
    expect(asNativeShopLink(navigation)).toBe(navigation);
  });

  it("opens a new Shop card on the current page without a nested item", () => {
    const html = renderToStaticMarkup(<PublicBlockRenderer link={{
      id: "shop",
      type: "link",
      title: "Store",
      description: "Products and services",
      url: "/shop",
      hideUrl: true,
    }} />);

    expect(html).toContain('href="/shop"');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("public-internal-link");
    expect(html).toContain("lucide-shopping-bag");
    expect(html).toContain("Products and services");
  });
});
