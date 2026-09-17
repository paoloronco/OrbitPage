import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { defaultTheme } from "@/lib/theme";
import { ProfileSection } from "./ProfileSection";

it("hides the page type choice in hosted pages while keeping studio details", () => {
  const profile = { name: "Orbit Studio", bio: "", avatar: "", appearance: { profilePreset: "studio" as const } };
  const html = renderToStaticMarkup(<ProfileSection profile={profile} theme={defaultTheme} onProfileUpdate={() => {}} pageTypeEditable={false} />);

  expect(html).not.toContain("Page type");
  expect(html).not.toContain("admin-profile-role-grid");
  expect(html).toContain("Specialty");
  expect(html).toContain("Studio location");
});
