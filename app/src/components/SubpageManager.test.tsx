import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultTheme } from "@/lib/theme";
import { SubpageManager, type EditorSubpage } from "./SubpageManager";

vi.mock("./LinkManager", () => ({ LinkManager: () => <div>Content editor</div> }));

describe("additional pages workspace", () => {
  it("does not render a second empty-state prompt", () => {
    const html = renderToStaticMarkup(
      <SubpageManager
        pages={[]}
        theme={defaultTheme}
        publicPageHref="https://example.com/paolo"
        onPagesUpdate={vi.fn()}
        editMode="full"
        maxPages={3}
      />,
    );

    expect(html).not.toContain("No additional pages yet");
    expect(html).not.toContain("Add your first page");
    expect(html).not.toContain("Site editor / Pages");
    expect(html).not.toContain("Give a topic, service or campaign its own URL.");
    expect(html).not.toContain("Your main page is always available.");
  });

  it("shows a single-page workflow with the selected page and its public state", () => {
    const page: EditorSubpage = {
      id: "services", slug: "services", title: "Services", description: "What I offer", links: [],
      enabled: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(
      <SubpageManager
        pages={[page]}
        theme={defaultTheme}
        publicPageHref="https://example.com/paolo"
        onPagesUpdate={vi.fn()}
        editMode="full"
        maxPages={3}
      />,
    );

    expect(html).toContain('<h2 class="visual-site-editor__title">Additional pages</h2>');
    expect(html).toContain('class="subpage-page-grid"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Page settings");
    expect(html).toContain("Build this page");
    expect(html).toContain("https://example.com/paolo/services");
    expect(html).toContain("Hidden");
    expect(html).toContain('title="Publish this page before opening its public URL"');
  });

  it("shows every active internal destination in the page tree", () => {
    const html = renderToStaticMarkup(
      <SubpageManager
        pages={[]}
        theme={defaultTheme}
        publicPageHref="https://example.com/paolo"
        onPagesUpdate={vi.fn()}
        editMode="full"
        internalDestinations={[
          { id: "home", kind: "link", path: "/", title: "Home", description: "Main page" },
          { id: "menu", kind: "menu", path: "/menu", title: "Menu", description: "Food and drinks" },
        ]}
      />,
    );

    expect(html).toContain('class="subpage-page-children"');
    expect(html).toContain("Menu");
    expect(html).toContain("/menu");
  });
});
