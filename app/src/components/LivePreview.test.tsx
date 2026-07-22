import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LivePreview } from "./LivePreview";
import { defaultTheme, normalizeTheme } from "@/lib/theme";

describe("LivePreview", () => {
  it("uses the public renderer and contains the real background video", () => {
    const theme = normalizeTheme({
      ...defaultTheme,
      backgroundMedia: {
        ...defaultTheme.backgroundMedia,
        type: "video",
        mediaUrl: "/media/prospect-background.mp4",
      },
    });

    const html = renderToStaticMarkup(
      <LivePreview
        profile={{
          name: "Prospect preview",
          bio: "The same content as the public page",
          avatar: "",
          showAvatar: false,
          footerText: "Public footer",
        }}
        links={[{
          id: "1",
          type: "link",
          title: "Book now",
          description: "",
          url: "https://example.com",
        }]}
        theme={theme}
        showOrbitPageBadge={false}
      />,
    );

    expect(html).toContain('data-background-layer-mode="container"');
    expect(html).toContain('/media/prospect-background.mp4');
    expect(html).toContain('Prospect preview');
    expect(html).toContain('Book now');
    expect(html).toContain('Public footer');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Cookie Policy');
    expect(html).not.toContain('Powered by');
  });

  it("renders global and per-card surface effects through the real public renderer", () => {
    const theme = normalizeTheme({
      ...defaultTheme,
      profileCardEffect: "liquid-glass",
      contentCardEffect: "transparent",
    });

    const html = renderToStaticMarkup(
      <LivePreview
        profile={{ name: "Glass profile", bio: "", avatar: "", showAvatar: false }}
        links={[
          { id: "theme-default", type: "link", title: "Transparent", description: "", url: "https://example.com" },
          { id: "override", type: "link", title: "Solid override", description: "", url: "https://example.com", surfaceEffect: "solid" },
        ]}
        theme={theme}
      />,
    );

    expect(html).toContain('profile-card glass-card');
    expect(html).toContain('data-surface-effect="liquid-glass"');
    expect(html).toContain('data-surface-effect="transparent"');
    expect(html).toContain('data-surface-effect="solid"');
  });

  it("keeps intentionally unboxed blocks out of global card surface effects", () => {
    const theme = normalizeTheme({
      ...defaultTheme,
      contentCardEffect: "liquid-glass",
    });

    const html = renderToStaticMarkup(
      <LivePreview
        profile={{ name: "Surface test", bio: "", avatar: "", showAvatar: false }}
        links={[
          { id: "heading", type: "heading", title: "Section", description: "", url: "" },
          { id: "link", type: "link", title: "Normal card", description: "", url: "https://example.com" },
        ]}
        theme={theme}
      />,
    );

    expect(html).toContain('public-unboxed-block border-none bg-transparent');
    expect(html).toContain('glass-card p-4');
    expect(html.match(/data-surface-effect="liquid-glass"/g)).toHaveLength(2);
  });
});
