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
});
