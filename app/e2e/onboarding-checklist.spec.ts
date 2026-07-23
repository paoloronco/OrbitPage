import { expect, test } from "@playwright/test";
import { openAuthenticatedAdmin } from "./helpers";

test("keeps the setup checklist session-aware and permanently dismissible", async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const checklist = page.getByRole("region", { name: "Page checklist" });
  await expect(checklist).toBeVisible();
  await expect(checklist).toContainText("login 1 of 3");
  await expect(checklist.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4");

  await page.goto("/dashboard/profile", { waitUntil: "commit" });
  await expect(checklist).toBeVisible();
  await expect(checklist).toContainText("login 1 of 3");

  await checklist.getByRole("button", { name: "Hide onboarding checklist" }).click();
  await expect(checklist).toBeHidden();
  await page.goto("/dashboard/profile", { waitUntil: "commit" });
  await expect(checklist).toBeHidden();
});
