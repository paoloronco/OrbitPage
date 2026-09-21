import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicLinkCard } from "./PublicLinkCard";

describe("PublicLinkCard media", () => {
  it("renders a configured image icon in the first committed markup", () => {
    const html = renderToStaticMarkup(
      <PublicLinkCard
        link={{
          id: "card-one",
          title: "Contact",
          description: "",
          url: "https://example.com",
          icon: "https://media.example/icon.webp",
          iconType: "image",
        }}
      />
    );

    expect(html).toContain('src="https://media.example/icon.webp"');
    expect(html).not.toContain('>C</span>');
  });

  it("renders semantic icons without requesting fake upload paths", () => {
    const html = renderToStaticMarkup(
      <PublicLinkCard
        link={{
          id: "instagram-card",
          title: "Instagram",
          description: "",
          url: "https://instagram.com/example",
          icon: "instagram",
        }}
      />
    );

    expect(html).toContain("lucide-instagram");
    expect(html).not.toContain("/uploads/instagram");
    expect(html).not.toContain('<img');
  });
});
