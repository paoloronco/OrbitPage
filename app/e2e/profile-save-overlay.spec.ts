import { expect, test } from "@playwright/test";

import { openAuthenticatedAdmin } from "./helpers";

test("shows a viewport-fixed save action only for real changes and offers timed revert", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openAuthenticatedAdmin(page);
  await page.getByRole("button", { name: "Page", exact: true }).click();

  const pageName = page.getByLabel("Page name");
  const originalName = await pageName.inputValue();
  const save = page.getByRole("button", { name: "Save page" });

  await expect(save).toBeHidden();
  await pageName.fill(`Floating save ${Date.now()}`);
  await expect(save).toBeVisible();
  await expect(save).toBeEnabled();

  const layer = page.locator(".admin-profile-save-layer");
  await expect(layer).toHaveCSS("position", "fixed");
  const desktopBeforeScroll = await layer.boundingBox();
  expect(desktopBeforeScroll).not.toBeNull();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const desktopAfterScroll = await layer.boundingBox();
  expect(desktopAfterScroll).not.toBeNull();
  expect(Math.abs(desktopAfterScroll!.x - desktopBeforeScroll!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktopAfterScroll!.y - desktopBeforeScroll!.y)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSaveBounds = await save.boundingBox();
  expect(mobileSaveBounds).not.toBeNull();
  expect(mobileSaveBounds!.height).toBeGreaterThanOrEqual(44);
  expect(mobileSaveBounds!.x + mobileSaveBounds!.width).toBeLessThanOrEqual(390);

  await save.click();
  await expect(save).toBeHidden();

  const notice = page.locator(".admin-profile-saved-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Saved");
  await expect(notice).toContainText("visible on the public page in about 10 seconds");
  await expect(notice.locator(".admin-profile-saved-notice__progress > i")).toHaveCSS("animation-duration", "8s");

  await notice.getByRole("button", { name: "Revert" }).click();
  await expect(pageName).toHaveValue(originalName);
  await expect(notice).toBeHidden();
  await expect(save).toBeHidden();
});
