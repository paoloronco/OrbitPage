import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicProfileSection } from "./PublicProfileSection";

describe("PublicProfileSection custom layout", () => {
  it("renders free coordinates and editor handles only while arranging", () => {
    const profile = {
      name: "Mario Rossi",
      bio: "Designer",
      avatar: "",
      showAvatar: false,
      appearance: {
        profileDetails: { primary: "Product designer", secondary: "Torino" },
        layout: {
          positions: {
            avatar: { x: 0, y: 0, width: 28, height: 96 },
            name: { x: 34, y: 0, width: 40, height: 96 },
            work: { x: 4, y: 104, width: 42, height: 40 },
            location: { x: 54, y: 104, width: 42, height: 40 },
            socials: { x: 10, y: 144, width: 80, height: 48 },
            bio: { x: 4, y: 120, width: 92, height: 72 },
          },
          height: 192,
        },
      },
    };

    const publicHtml = renderToStaticMarkup(<PublicProfileSection profile={profile} />);
    expect(publicHtml).toContain('data-profile-layout-position="34,0,40,96"');
    expect(publicHtml).toContain('--profile-layout-height:192px');
    expect(publicHtml).not.toContain("profile-card__layout-grip");

    const editorHtml = renderToStaticMarkup(<PublicProfileSection layoutEditing onLayoutChange={() => undefined} profile={profile} />);
    expect(editorHtml).toContain("profile-card--layout-editing");
    expect(editorHtml).toContain("profile-card__layout-grip");
    expect(editorHtml).toContain("profile-card__layout-resize");
  });
});
