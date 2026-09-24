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

it("groups profile controls in their visible page sections", () => {
  const profile = { name: "Orbit Studio", bio: "", avatar: "", appearance: {} };
  const html = renderToStaticMarkup(<ProfileSection profile={profile} theme={defaultTheme} onProfileUpdate={() => {}} visualMode />);

  expect(html).toContain('admin-profile-identity-fields grid gap-5"');
  expect(html.indexOf("Image border")).toBeLessThan(html.indexOf("Name and details"));
  expect(html).not.toContain("Outline the profile image.");
  expect(html).not.toContain("Image border color");
  expect(html.indexOf("Online presence")).toBeLessThan(html.indexOf("Search description"));
  expect(html.indexOf("Footer text")).toBeLessThan(html.indexOf("Social links"));
  expect(html.indexOf("Social links")).toBeLessThan(html.indexOf("Advanced settings"));
  expect(html.indexOf("Footer text")).toBeLessThan(html.indexOf("Advanced settings"));
  expect(html).toContain("Typography and technical options.");
});
