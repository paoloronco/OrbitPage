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

  it("replaces the homepage renderer for Menu and Shop previews", () => {
    const renderPreview = vi.fn(() => <div>Specialized public preview</div>);

    const html = renderToStaticMarkup(
      <VisualSiteEditor
        profile={{ name: "OrbitPage", bio: "", avatar: "" }}
        links={[]}
        theme={defaultTheme}
        publicPageHref="/orbitpage"
        showOrbitPageBadge
        section="menu"
        inspectorTitle="Menu"
        inspectorDescription="Edit menu"
        inspector={<div>Inspector</div>}
        onSelect={vi.fn()}
        layoutEditing={false}
        onLayoutEditingChange={vi.fn()}
        previewHint="Live menu preview"
        renderPreview={renderPreview}
      />,
    );

    expect(renderPreview).toHaveBeenCalledWith("mobile");
    expect(html).toContain("Specialized public preview");
    expect(html).toContain("Live menu preview");
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
