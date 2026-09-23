import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  livePreviewProps: null as null | Record<string, unknown>,
}));

vi.mock("./LivePreview", () => ({
  PreviewDeviceToggle: () => <div>PreviewDeviceToggle</div>,
  LivePreview: (props: Record<string, unknown>) => {
    mockState.livePreviewProps = props;
    return <div>LivePreview</div>;
  },
}));

import { VisualSiteEditor } from "./VisualSiteEditor";
import { defaultTheme } from "@/lib/theme";

describe("VisualSiteEditor", () => {
  it("keeps style out of the editor and sends background editing to Theme", () => {
    const onSelect = vi.fn();
    const onOpenTheme = vi.fn();

    const html = renderToStaticMarkup(
      <VisualSiteEditor
        profile={{ name: "OrbitPage", bio: "", avatar: "" }}
        links={[]}
        theme={defaultTheme}
        publicPageHref="/orbitpage"
        showOrbitPageBadge
        section="profile"
        inspectorTitle="Profile"
        inspectorDescription="Edit profile"
        inspector={<div>Inspector</div>}
        onSelect={onSelect}
        onOpenTheme={onOpenTheme}
        layoutEditing={false}
        onLayoutEditingChange={vi.fn()}
      />,
    );

    expect(html).toContain(">Page</span>");
    expect(html).toContain(">Content</span>");
    expect(html).not.toContain(">Style</span>");
    expect(html).not.toContain(">Stile</span>");

    const onEditorSelect = mockState.livePreviewProps?.onEditorSelect as ((target: { kind: "page" }) => void) | undefined;
    expect(onEditorSelect).toBeTypeOf("function");
    onEditorSelect?.({ kind: "page" });

    expect(onOpenTheme).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows Menu preview only when its Design panel provides one", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const renderPreview = vi.fn(() => <div>Specialized public preview</div>);

    const props = {
      profile: { name: "OrbitPage", bio: "", avatar: "" },
      links: [],
      theme: defaultTheme,
      publicPageHref: "/orbitpage",
      showOrbitPageBadge: true,
      section: "menu" as const,
      inspectorTitle: "Menu",
      inspectorDescription: "Edit menu",
      inspector: <div>Inspector</div>,
      onSelect: vi.fn(),
      layoutEditing: false,
      onLayoutEditingChange: vi.fn(),
      previewHint: "Live menu preview",
    };
    const withoutDesign = renderToStaticMarkup(<VisualSiteEditor {...props} />);
    const withDesign = renderToStaticMarkup(
      <VisualSiteEditor
        {...props}
        renderPreview={renderPreview}
      />,
    );

    expect(withoutDesign).toContain("visual-site-editor--inspector-only");
    expect(withoutDesign).not.toContain("visual-site-editor__canvas");
    expect(withDesign).toContain("visual-site-editor--menu visual-site-editor--preview-visible");
    expect(withDesign).toContain("Specialized public preview");
    expect(withDesign).not.toContain("Show preview");
    expect(renderPreview).toHaveBeenCalledOnce();
    expect(renderPreview).toHaveBeenCalledWith("mobile");
    vi.unstubAllGlobals();
  });

  it("gives Shop the full editor width without a persistent preview", () => {
    const renderPreview = vi.fn(() => <div>Shop preview</div>);

    const html = renderToStaticMarkup(
      <VisualSiteEditor
        profile={{ name: "OrbitPage", bio: "", avatar: "" }}
        links={[]}
        theme={defaultTheme}
        publicPageHref="/orbitpage"
        showOrbitPageBadge
        section="shop"
        inspectorTitle="Shop"
        inspectorDescription="Manage Shop"
        inspector={<div>Shop workspace</div>}
        onSelect={vi.fn()}
        layoutEditing={false}
        onLayoutEditingChange={vi.fn()}
        renderPreview={renderPreview}
      />,
    );

    expect(html).toContain("visual-site-editor--inspector-only");
    expect(html).not.toContain("Manage your Shop");
    expect(html).toContain("data-orbitpage-hosted-shop-header-slot");
    expect(html).toContain("Shop workspace");
    expect(html).not.toContain("visual-site-editor__canvas");
    expect(html).not.toContain("PreviewDeviceToggle");
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it("shows Pages preview only when a selected additional page supplies it", () => {
    const props = {
      profile: { name: "Main page", bio: "", avatar: "" },
      links: [],
      theme: defaultTheme,
      publicPageHref: "/orbitpage",
      showOrbitPageBadge: true,
      section: "pages" as const,
      inspectorTitle: "Additional pages",
      inspectorDescription: "Edit pages",
      inspector: <div>Page workspace</div>,
      onSelect: vi.fn(),
      layoutEditing: false,
      onLayoutEditingChange: vi.fn(),
    };
    const withoutPage = renderToStaticMarkup(<VisualSiteEditor {...props} />);
    const withPage = renderToStaticMarkup(<VisualSiteEditor {...props} renderPreview={() => <div>Selected subpage preview</div>} />);

    expect(withoutPage).toContain("visual-site-editor--inspector-only");
    expect(withoutPage).not.toContain("visual-site-editor__canvas");
    expect(withPage).toContain("Selected subpage preview");
    expect(withPage).not.toContain("Selected element");
  });

  it("removes the top Done and Reset actions while arranging", () => {
    const html = renderToStaticMarkup(
      <VisualSiteEditor
        profile={{ name: "OrbitPage", bio: "", avatar: "" }}
        links={[]}
        theme={defaultTheme}
        publicPageHref="/orbitpage"
        showOrbitPageBadge
        section="profile"
        inspectorTitle="Profile"
        inspectorDescription="Edit profile"
        inspector={<div>Inspector</div>}
        onSelect={vi.fn()}
        onProfileLayoutChange={vi.fn()}
        onCardLayoutChange={vi.fn()}
        layoutEditing
        onLayoutEditingChange={vi.fn()}
      />,
    );

    expect(html).not.toContain(">Done</span>");
    expect(html).not.toContain(">Reset</span>");
    expect(mockState.livePreviewProps?.profileLayoutEditing).toBe(true);
    expect(mockState.livePreviewProps?.cardLayoutEditing).toBe(true);
  });

  it("hides Arrange and offers a preview disclosure on smartphones", () => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({ matches: query === "(max-width: 600px)" }),
    });

    try {
      const html = renderToStaticMarkup(
        <VisualSiteEditor
          profile={{ name: "OrbitPage", bio: "", avatar: "" }}
          links={[]}
          theme={defaultTheme}
          publicPageHref="/orbitpage"
          showOrbitPageBadge
          section="profile"
          inspectorTitle="Profile"
          inspectorDescription="Edit profile"
          inspector={<div>Inspector</div>}
          onSelect={vi.fn()}
          onProfileLayoutChange={vi.fn()}
          onCardLayoutChange={vi.fn()}
          layoutEditing={false}
          onLayoutEditingChange={vi.fn()}
        />,
      );

      expect(html).not.toContain(">Arrange</span>");
      expect(html).toContain(">Hide Preview</span>");
      expect(html).toContain('aria-controls="visual-site-editor-preview"');
      expect(html).toContain('aria-expanded="true"');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
