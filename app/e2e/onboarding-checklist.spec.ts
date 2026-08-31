import { expect, test } from "@playwright/test";
import { openAuthenticatedAdmin } from "./helpers";

test("keeps guided setup out of the classic and new dashboard UI", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);

  const removedGuidance = page.locator(".admin-onboarding-welcome, .admin-onboarding-panel, .admin-checklist-panel");
  await expect(removedGuidance).toHaveCount(0);
  await expect(page.getByText("Guided setup", { exact: true })).toHaveCount(0);

  const newUiSwitch = page.getByRole("switch", { name: "Enable New UI beta" });
  if (!(await newUiSwitch.isChecked())) await newUiSwitch.click();
  await expect(page.locator(".visual-site-editor")).toBeVisible();
  await expect(removedGuidance).toHaveCount(0);
  await expect(page.getByText("Guided setup", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".visual-site-editor")).toBeVisible();
  await expect(removedGuidance).toHaveCount(0);
});
