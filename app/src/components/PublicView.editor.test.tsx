import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultTheme } from "@/lib/theme";
import { PublicView } from "./PublicView";

const profile = {
  name: "Visual editor",
  bio: "Select the real page",
  avatar: "",
  showAvatar: false,
};

const links = [{
  id: "visual-link",
  type: "link" as const,
  title: "Book a call",
  description: "",
  url: "https://example.com",
}];

describe("PublicView visual editor targets", () => {
  it("makes the real profile and content blocks selectable in editor mode", () => {
    const html = renderToStaticMarkup(
      <PublicView
        editorSelection={{ kind: "link", id: "visual-link" }}
        links={links}
        onEditorSelect={() => undefined}
        profile={profile}
        theme={defaultTheme}
      />,
    );

    expect(html).toContain("public-page-root--editor");
    expect(html).toContain('data-public-editor-target="profile"');
    expect(html).toContain('data-public-editor-link-id="visual-link"');
    expect(html).toContain("public-editor-target--link is-selected");
    expect(html).toContain('aria-label="Edit profile and page identity"');
    expect(html).toContain('aria-label="Edit Book a call"');
  });

  it("does not add editor controls to the public page", () => {
    const html = renderToStaticMarkup(
      <PublicView links={links} profile={profile} theme={defaultTheme} />,
    );

    expect(html).not.toContain("public-page-root--editor");
    expect(html).not.toContain("data-public-editor-target");
    expect(html).not.toContain("data-public-editor-link-id");
  });

  it("renders saved desktop card and inner-content coordinates on the public page", () => {
    const html = renderToStaticMarkup(
      <PublicView
        embedded
        embeddedViewport="desktop"
        links={links}
        profile={{
          ...profile,
          appearance: {
            cardLayouts: {
              desktop: {
                positions: { "visual-link": { x: 48, y: 20, width: 52, height: 120 } },
                contents: {
                  "visual-link": {
                    positions: { title: { x: 5, y: 30, width: 70, height: 30 } },
                    height: 76,
                  },
                },
                height: 140,
              },
            },
          },
        }}
        theme={defaultTheme}
      />,
    );

    expect(html).toContain("public-page-root--responsive-card-layout");
    expect(html).toContain('data-card-layout-viewport="desktop"');
    expect(html).toContain('data-card-layout-position="48,20,52,120"');
    expect(html).toContain('data-card-content-layout-position="5,30,70,30"');
  });
});
