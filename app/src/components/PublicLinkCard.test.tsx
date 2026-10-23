import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PublicLinkCard } from "./PublicLinkCard";

describe("PublicLinkCard media", () => {
  it.each([
    [undefined, false, 'https://example.com', undefined, false],
    [false, false, 'https://example.com', undefined, false],
    [true, false, 'https://example.com', undefined, true],
    [true, true, 'https://example.com', undefined, true],
    [true, false, '', undefined, false],
    [true, false, 'javascript:alert(1)', undefined, false],
    [true, false, 'https://example.com', 'unavailable', false],
  ] as const)("renders copy only when enabled with an available safe URL (%s, %s, %s, %s)", (showCopyButton, hideUrl, url, availability, visible) => {
    const html = renderToStaticMarkup(<PublicLinkCard link={{ id: 'copy', title: 'Website', description: '', url, showCopyButton, hideUrl, availability }} />);
    expect(html.includes('aria-label="Copy link"')).toBe(visible);
    if (url === 'https://example.com' && !availability) expect(html).toContain(`href="${url}"`);
  });

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

  it("leaves iconless cards empty and coordinates a single open editor", () => {
    const html = renderToStaticMarkup(
      <PublicLinkCard
        link={{
          id: "plain-card",
          title: "Contact",
          description: "",
          url: "https://example.com",
        }}
      />
    );
    const managerSource = readFileSync(new URL("./LinkManager.tsx", import.meta.url), "utf8");

    expect(html).not.toContain(">C</span>");
    expect(managerSource).toContain("const [editingLinkId, setEditingLinkId] = useState<string | null>(null)");
    expect(managerSource.match(/editing=\{visualMode \? true : editingLinkId === String\(link\.id\)\}/g)).toHaveLength(2);
    expect(managerSource.match(/onEditingChange=\{updateEditingLink\}/g)).toHaveLength(2);
  });
});
