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
  await inspector.getByLabel("Page name").fill(`Visual editor profile ${browserName} ${Date.now()}`);
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

test("New UI keeps mobile navigation and editor destinations explicit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem("orbitpage.admin.new-ui", "true"));
  await openAuthenticatedAdmin(page);

  const topbarPublicPage = page.locator(".admin-dashboard-mobile-public-page");
  await expect(topbarPublicPage).toBeVisible();
  await expect(topbarPublicPage).toHaveAccessibleName("Open public page");
  const topbarPublicPageBounds = await topbarPublicPage.boundingBox();
  expect(topbarPublicPageBounds).not.toBeNull();
  expect(topbarPublicPageBounds!.height).toBeGreaterThanOrEqual(44);

  await expect(page.locator(".admin-dashboard-header .admin-new-ui-toggle")).toBeHidden();
  await expect(page.locator(".admin-dashboard-header-public-page")).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();

  const mobileMode = page.locator(".admin-dashboard-mobile-editor-mode");
  await expect(mobileMode).toBeVisible();
  await expect(mobileMode).toContainText("Site editor");
  await expect(mobileMode).toContainText("Beta");
  await expect(mobileMode).toHaveRole("switch");
  await expect(mobileMode).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Close navigation" }).first().click();

  const destinations = page.getByRole("navigation", { name: "Site sections" }).getByRole("button");
  await expect(destinations).toHaveCount(6);
  for (const label of ["Page", "Content", "Menu", "Shop", "Pages", "Style"]) {
    const destination = destinations.filter({ hasText: label }).first();
    await expect(destination).toBeVisible();
    await expect(destination.locator("span")).not.toHaveCSS("display", "none");
    const bounds = await destination.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(48);
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 320, height: 740 });
  await expect(topbarPublicPage).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  const compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(compactOverflow).toBeLessThanOrEqual(1);
});
