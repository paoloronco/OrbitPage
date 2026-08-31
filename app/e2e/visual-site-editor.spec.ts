import { expect, test } from "@playwright/test";
import { openAuthenticatedAdmin } from "./helpers";

test("New UI edits the real page through selectable elements and keeps the preference", async ({ browserName, page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);

  const newUiSwitch = page.getByRole("switch", { name: "Enable New UI beta" });
  if (await newUiSwitch.isChecked()) await newUiSwitch.click();

  await page.getByRole("button", { name: "Content", exact: true }).click();

  let linkCard;
  if (await page.locator(".admin-link-list [data-link-id]").count() === 0) {
    await page.getByRole("button", { name: "Add link" }).click();
    linkCard = page.locator(".admin-link-list [data-link-id]").last();
  } else {
    await page.getByRole("button", { name: "Add content" }).click();
    await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
    linkCard = page.locator(".admin-link-list [data-link-id]").last();
  }

  await expect(linkCard).toBeVisible();
  const linkId = await linkCard.getAttribute("data-link-id");
  expect(linkId).toBeTruthy();

  await linkCard.hover();
  await linkCard.getByRole("button", { name: "Edit block" }).click();
  await linkCard.getByPlaceholder("Link title").fill("Visual editor card");
  await linkCard.getByPlaceholder("https://example.com", { exact: true }).fill("https://example.com/visual-editor");
  await linkCard.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".admin-link-manager > .admin-link-toolbar .admin-link-actions").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved changes")).toBeHidden();

  await page.getByRole("button", { name: "Page", exact: true }).click();
  await newUiSwitch.click();
  await expect(newUiSwitch).toBeChecked();
  await expect(page.locator(".visual-site-editor")).toBeVisible();
  await expect(page.locator(".admin-dashboard-nav-page .admin-dashboard-content-nav")).toHaveCount(0);
  await expect(page.locator(".admin-dashboard-nav-page").getByRole("button", { name: "Site editor", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("switch", { name: "Enable New UI beta" })).toBeChecked();
  await expect(page.locator(".visual-site-editor")).toBeVisible();

  const inspector = page.locator(".visual-site-editor__inspector");
  await inspector.getByLabel("Page name").fill(`Visual editor profile ${browserName}`);
  await inspector.getByRole("button", { name: "Save page" }).click();
  await expect(page.locator('[data-public-editor-target="profile"]')).toBeVisible();
  await page.locator('[data-public-editor-target="profile"]').click();
  await expect(inspector.getByRole("heading", { name: "Profile and identity" })).toBeVisible();
  await expect(inspector.getByLabel("Page name")).toBeVisible();

  await page.locator(`[data-public-editor-link-id="${linkId}"]`).click();
  await expect(inspector.getByRole("heading", { name: "Visual editor card", exact: true }).first()).toBeVisible();
  await expect(inspector.getByPlaceholder("Link title")).toHaveValue("Visual editor card");
  await expect(inspector.getByPlaceholder("https://example.com", { exact: true })).toHaveValue("https://example.com/visual-editor");

  await page.locator(".public-page-root--editor").dispatchEvent("click");
  await expect(inspector.getByRole("heading", { name: "Page style" })).toBeVisible();

  await page.getByRole("switch", { name: "Enable New UI beta" }).click();
  await expect(page.locator(".visual-site-editor")).toBeHidden();
  await expect(page.locator(".admin-dashboard-nav-page .admin-dashboard-content-nav")).toBeVisible();
});
