import { expect, test } from "@playwright/test";

import { openAuthenticatedAdmin } from "./helpers";

test("persists the profile image size and renders it exactly on the public page", async ({ browserName, page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAuthenticatedAdmin(page);

  const pageSection = page.getByRole("button", { name: "Page", exact: true });
  await expect(pageSection).toBeVisible();
  await pageSection.click();

  const pageName = page.getByLabel("Page name");
  await pageName.fill(`Avatar size ${browserName}`);

  const showAvatar = page.getByRole("switch", { name: "Show profile image" });
  if (!(await showAvatar.isChecked())) await showAvatar.click();
  await expect(showAvatar).toBeChecked();

  const avatarSize = page.getByRole("slider", { name: "Profile image size" });
  await expect(avatarSize).toBeVisible();
  await avatarSize.focus();
  await page.keyboard.press("End");
  await expect(avatarSize).toHaveAttribute("aria-valuenow", "192");

  const save = page.getByRole("button", { name: "Save page" });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();

  await page.goto("/", { waitUntil: "load" });
  const publicAvatar = page.locator(".public-page-root--standalone .profile-card__avatar");
  await expect(publicAvatar).toBeVisible();
  await expect(publicAvatar).toHaveCSS("width", "192px");
  await expect(publicAvatar).toHaveCSS("height", "192px");

  await page.goto("/admin", { waitUntil: "load" });
  await expect(page.locator(".admin-dashboard-shell")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Profile image size" })).toHaveAttribute("aria-valuenow", "192");
});
