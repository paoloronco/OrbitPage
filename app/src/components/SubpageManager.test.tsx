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

    expect(html).toContain("Additional pages");
    expect(html).toContain('class="subpage-page-grid"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Page settings");
    expect(html).toContain("Build this page");
    expect(html).toContain("https://example.com/paolo/services");
    expect(html).toContain("Hidden");
    expect(html).toContain('title="Publish this page before opening its public URL"');
  });
});
