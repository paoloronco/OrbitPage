import { expect, test } from "@playwright/test";

import { openAuthenticatedAdmin } from "./helpers";

test("keeps the shared theme color picker usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("button", { name: "Open controls" }).click();

  const trigger = page.getByRole("button", { name: /^Primary: #[0-9A-F]{6}$/ });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Primary color picker" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".react-colorful__saturation")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Pick Primary from the screen" })).toBeVisible();

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);

  const hexInput = dialog.getByRole("textbox", { name: "Primary HEX value" });
  await hexInput.fill("#123456");
  await expect(trigger).toHaveAttribute("aria-label", "Primary: #123456");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
