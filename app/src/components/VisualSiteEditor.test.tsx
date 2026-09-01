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
        previewHint="Live menu preview"
        renderPreview={renderPreview}
      />,
    );

    expect(renderPreview).toHaveBeenCalledWith("mobile");
    expect(html).toContain("Specialized public preview");
    expect(html).toContain("Live menu preview");
  });
});
