import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFILE_CARD_LAYOUT_ID } from "@/lib/card-layout";
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

  it("renders the profile and a content card in the same saved desktop canvas", () => {
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
                positions: {
                  [PROFILE_CARD_LAYOUT_ID]: { x: 0, y: 0, width: 49, height: 456 },
                  "visual-link": { x: 51, y: 0, width: 49, height: 120 },
                },
                height: 456,
              },
            },
          },
        }}
        theme={defaultTheme}
      />,
    );

    expect(html).toContain(`data-card-layout-item="${PROFILE_CARD_LAYOUT_ID}"`);
    expect(html).toContain('data-card-layout-position="0,0,49,456"');
    expect(html).toContain('data-card-layout-position="51,0,49,120"');
  });
});
