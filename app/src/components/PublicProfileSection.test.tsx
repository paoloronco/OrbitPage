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
      socialLinks: { github: "https://github.com/orbitpage" },
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
    expect(publicHtml).toContain("profile-card__title--stacked");
    expect(publicHtml).toContain(">Mario</span><span>Rossi</span>");
    expect(publicHtml).toContain('profile-card__layout-item--socials" data-profile-layout-align="center"');
    expect(publicHtml).not.toContain("profile-card__layout-grip");

    const editorHtml = renderToStaticMarkup(<PublicProfileSection layoutEditing onLayoutChange={() => undefined} profile={profile} />);
    expect(editorHtml).toContain("profile-card--layout-editing");
    expect(editorHtml).toContain("profile-card__layout-grip");
    expect(editorHtml).toContain("profile-card__layout-resize");
  });

  it("selects independent responsive layouts without changing their relative coordinates", () => {
    const profile = {
      name: "Mario Rossi",
      bio: "Designer",
      avatar: "",
      showAvatar: false,
      appearance: {
        layouts: {
          mobile: {
            positions: { name: { x: 10, y: 128, width: 80, height: 64 } },
            height: 408,
          },
          desktop: {
            positions: {
              name: { x: 55, y: 24, width: 35, height: 72 },
              bio: { x: 5, y: 168, width: 90, height: 72 },
            },
            height: 240,
          },
        },
      },
    };

    const mobileHtml = renderToStaticMarkup(<PublicProfileSection layoutViewport="mobile" profile={profile} />);
    expect(mobileHtml).toContain('data-profile-layout-viewport="mobile"');
    expect(mobileHtml).toContain('data-profile-layout-position="10,128,80,64"');
    expect(mobileHtml).toContain('--profile-layout-height:408px');

    const desktopHtml = renderToStaticMarkup(<PublicProfileSection layoutViewport="desktop" profile={profile} />);
    expect(desktopHtml).toContain('data-profile-layout-viewport="desktop"');
    expect(desktopHtml).toContain('data-profile-layout-position="55,24,35,72"');
    expect(desktopHtml).toContain('--profile-layout-height:240px');
  });
});
