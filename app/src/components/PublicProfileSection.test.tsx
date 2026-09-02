import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicProfileSection } from "./PublicProfileSection";

describe("PublicProfileSection custom layout", () => {
  it("renders the saved order, widths and editor handles only while arranging", () => {
    const profile = {
      name: "Mario Rossi",
      bio: "Designer",
      avatar: "",
      showAvatar: false,
      appearance: {
        profileDetails: { primary: "Product designer", secondary: "Torino" },
        layout: {
          order: ["name", "avatar", "location", "work", "socials", "bio"] as const,
          spans: { name: 1 as const, avatar: 1 as const, bio: 2 as const },
          gap: 20,
        },
      },
    };

    const publicHtml = renderToStaticMarkup(<PublicProfileSection profile={profile} />);
    expect(publicHtml.indexOf('data-profile-layout-item="name"')).toBeLessThan(publicHtml.indexOf('data-profile-layout-item="location"'));
    expect(publicHtml).toContain('--profile-layout-gap:20px');
    expect(publicHtml).not.toContain("profile-card__layout-grip");

    const editorHtml = renderToStaticMarkup(<PublicProfileSection layoutEditing onLayoutChange={() => undefined} profile={profile} />);
    expect(editorHtml).toContain("profile-card--layout-editing");
    expect(editorHtml).toContain("profile-card__layout-grip");
    expect(editorHtml).toContain("profile-card__layout-resize");
  });
});
