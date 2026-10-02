import { expect, test, type Locator } from "@playwright/test";
import { contentSaveButton, openAuthenticatedAdmin, openPreviewContentCard, saveEditorChanges } from "./helpers";

async function protrudingMenuContent(editor: Locator) {
  return editor.evaluate((element) => {
    const edge = element.getBoundingClientRect();
    return [...element.querySelectorAll('*')]
      .filter((child) => {
        const bounds = child.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && getComputedStyle(child).visibility !== 'hidden'
          && (bounds.left < edge.left - 1 || bounds.right > edge.right + 1);
      })
      .slice(0, 8)
      .map((child) => ({ tag: child.tagName, className: child.getAttribute('class') }));
  });
}

test("Page and Content keep the same editor and preview geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).scrollbarGutter)).toBe("stable");

  const geometry = () => page.locator(".visual-site-editor__workspace").evaluate((workspace) => {
    const preview = workspace.querySelector<HTMLElement>(".visual-site-editor__canvas")!;
    const inspector = workspace.querySelector<HTMLElement>(".visual-site-editor__inspector")!;
    return {
      workspace: workspace.getBoundingClientRect().width,
      preview: preview.getBoundingClientRect().width,
      inspector: inspector.getBoundingClientRect().width,
    };
  });

  await page.getByRole("button", { name: "Page", exact: true }).click();
  const pageGeometry = await geometry();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(page.locator(".visual-site-editor__inspector")).toHaveAttribute("aria-label", "Content block");
  const contentGeometry = await geometry();

  expect(contentGeometry).toEqual(pageGeometry);
});

test("Visual editor persists profile and content selected on the real preview", async ({ browserName, page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const pageName = `Visual editor ${browserName} ${Date.now()}`;
  const inspector = page.locator(".visual-site-editor__inspector");
  const profile = page.locator('[data-public-editor-target="profile"]');
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await inspector.getByLabel("Page name").fill(pageName);
  await saveEditorChanges(page);
  await profile.click();
  await expect(profile).toHaveClass(/is-selected/);

  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByRole("button", { name: "Add content" }).click();
  await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
  await saveEditorChanges(page);
  const card = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor, id } = await openPreviewContentCard(page, card);
  await expect(card).toHaveClass(/is-selected/);
  await editor.getByPlaceholder("Link title").fill("Visual editor saved card");
  await editor.getByPlaceholder("https://example.com", { exact: true }).fill("https://example.com/visual-editor");
  await expect(card).toContainText("Visual editor saved card");
  await saveEditorChanges(page);

  await page.reload();
  const savedCard = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${id}"]`);
  const { editor: savedEditor } = await openPreviewContentCard(page, savedCard);
  await expect(savedEditor.getByPlaceholder("Link title")).toHaveValue("Visual editor saved card");
  await expect(savedEditor.getByPlaceholder("https://example.com", { exact: true })).toHaveValue("https://example.com/visual-editor");
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await expect(inspector.getByLabel("Page name")).toHaveValue(pageName);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: pageName, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Visual editor saved card/ })).toHaveAttribute("href", "https://example.com/visual-editor");
});

test("Arrange uses preset sizes, compact handles and persistent text alignment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  await page.getByRole("textbox", { name: "Role or focus" }).fill("Work");
  await page.getByRole("textbox", { name: "Location" }).fill("Turin");
  await contentSaveButton(page).click();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByRole("button", { name: "Add content" }).click();
  await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
  await contentSaveButton(page).click();

  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  const workItem = page.locator('[data-profile-layout-item="work"]');
  const locationItem = page.locator('[data-profile-layout-item="location"]');
  await page.getByRole("button", { name: "Align center Work", exact: true }).click();
  await page.getByRole("button", { name: "Align center Location", exact: true }).click();
  await expect(workItem).toHaveAttribute("data-profile-layout-align", "center");
  await expect(locationItem).toHaveAttribute("data-profile-layout-align", "center");
  await page.getByRole("button", { name: "Align left Work", exact: true }).click();
  await expect(workItem).toHaveAttribute("data-profile-layout-align", "left");

  const contentCard = page.locator('[data-card-layout-item]:not([data-card-layout-item="orbitpage-profile"])').last();
  const moveHandle = contentCard.getByRole("button", { name: /^Move card/ });
  const handleBounds = await moveHandle.boundingBox();
  expect(handleBounds).not.toBeNull();
  expect(await moveHandle.evaluate((element) => Number.parseFloat(getComputedStyle(element).width))).toBe(64);

  await contentCard.getByRole("button", { name: /^Resize card/ }).press("ArrowRight");
  await expect.poll(async () => {
    const resized = (await contentCard.getAttribute("data-card-layout-position"))!.split(",").map(Number);
    return [25, 33.25, 39, 40, 50, 66.75, 75, 100].includes(resized[2]);
  }).toBe(true);

  await contentSaveButton(page).click();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await expect(page.locator('[data-profile-layout-item="work"]')).toHaveAttribute("data-profile-layout-align", "left");
});

test("card resize returns to its default width and Reset restores Arrange", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByRole("button", { name: "Add content" }).click();
  await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
  await contentSaveButton(page).click();
  const cardId = await page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last().getAttribute('data-public-editor-link-id');

  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  const card = page.locator(`[data-card-layout-item="${cardId}"]`);
  const width = async () => Number((await card.getAttribute("data-card-layout-position"))!.split(",")[2]);
  const defaultWidth = await width();
  const resize = card.getByRole("button", { name: /^Resize card/ });
  await resize.press("ArrowRight");
  await expect.poll(width).not.toBe(defaultWidth);
  await resize.press("ArrowLeft");
  await expect.poll(width).toBe(defaultWidth);

  const dragToWidth = async (targetWidth: number) => {
    const handle = (await resize.boundingBox())!;
    const canvasWidth = await page.locator('.public-card-stack--layout').evaluate((element) => element.getBoundingClientRect().width);
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (targetWidth - await width()) / 100 * canvasWidth, y, { steps: 4 });
    await page.mouse.up();
  };
  await dragToWidth(50);
  await expect.poll(width).toBe(50);
  await dragToWidth(defaultWidth);
  await expect.poll(width).toBe(defaultWidth);

  await resize.press("ArrowRight");
  await page.locator(".admin-profile-save-float").getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await expect.poll(width).toBe(defaultWidth);
});

test("Visual editor keeps mobile navigation and destinations explicit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  const topbarPublicPage = page.locator(".admin-dashboard-mobile-public-page");
  await expect(topbarPublicPage).toBeVisible();
  await expect(topbarPublicPage).toHaveAccessibleName("Public page");
  const topbarPublicPageBounds = await topbarPublicPage.boundingBox();
  expect(topbarPublicPageBounds).not.toBeNull();
  expect(topbarPublicPageBounds!.height).toBeGreaterThanOrEqual(44);

  await expect(page.locator(".admin-dashboard-header-public-page")).toBeHidden();
  await expect(page.locator('[data-preview-device="mobile"]')).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();

  await expect(page.getByText("Classic UI", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Close navigation" }).first().click();

  const destinations = page.getByRole("navigation", { name: "Site sections" }).locator(":scope > button");
  await expect(destinations).toHaveCount(5);
  for (const label of ["Page", "Content", "Menu", "Shop", "Pages"]) {
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

test("Visual editor restores the selected section from its URL", async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const sections = page.getByRole("navigation", { name: "Site sections" });
  for (const [name, slug] of [["Page", "page"], ["Content", "content"], ["Menu", "menu/content"], ["Shop", "shop/products"], ["Pages", "pages"]] as const) {
    const destination = sections.getByRole("button", { name, exact: true });
    await destination.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/editor/${slug}$`));
    await expect(destination).toHaveAttribute("aria-current", "page");
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard\/editor\/shop\/products$/);
  await expect(sections.getByRole("button", { name: "Shop", exact: true })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(sections.getByRole("button", { name: "Shop", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Visual editor gives Menu a focused inspector without clipped labels", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("button", { name: "Menu", exact: true }).click();

  const inspector = page.locator(".visual-site-editor__inspector");
  const editor = inspector.locator(".menu-editor-stack--visual");
  const workflow = editor.getByRole("navigation", { name: "Menu setup workflow" });
  const canvas = page.locator(".visual-site-editor__canvas");
  await expect(editor).toBeVisible();
  await expect(canvas.locator(".admin-menu-live-preview")).toHaveCount(0);
  await expect(canvas.locator(".admin-live-preview")).toHaveCount(0);
  await expect(editor.locator(".menu-design-preview")).toHaveCount(0);
  await expect(workflow).toBeVisible();
  await expect(workflow.getByRole("button")).toHaveCount(3);
  const workflowBeforeSettings = await workflow.boundingBox();
  await workflow.getByRole("button", { name: /Settings/ }).click();
  await expect(editor.getByRole("heading", { name: "Menu details" })).toBeVisible();
  await expect(editor.getByRole("heading", { name: "Publication" })).toBeVisible();
  const publicationSwitch = editor.getByRole("switch", { name: "Public menu visibility" });
  const wasPublished = await publicationSwitch.isChecked();
  await publicationSwitch.click();
  await expect(publicationSwitch).toHaveAttribute("aria-checked", String(!wasPublished));
  await publicationSwitch.click();
  await expect(editor.getByText("Unsaved changes", { exact: true })).toBeHidden();
  await workflow.getByRole("button", { name: "Menu", exact: true }).click();
  const workflowAfterSettings = await workflow.boundingBox();
  expect(workflowBeforeSettings && workflowAfterSettings).toBeTruthy();
  expect(Math.abs(workflowAfterSettings!.y - workflowBeforeSettings!.y)).toBeLessThanOrEqual(1);
  await expect(editor.getByText("Pro menu", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Selected element", { exact: true })).toHaveCount(0);
  await expect(editor.locator(".menu-visual-context")).toHaveCount(0);
  await expect(editor.locator(".menu-unified-panel")).toBeVisible();
  await expect(editor.locator(".menu-unified-side .menu-category-editor-empty")).toBeVisible();
  await expect(editor.locator(".menu-category-accordion")).toHaveCount(0);
  await expect(editor.locator(".menu-category-editor")).toHaveCount(0);
  const category = editor.locator(".menu-category-group").first();
  await expect(category).toBeVisible();
  await category.locator(".menu-category-group__edit").click();
  await expect(editor.locator(".menu-category-editor").getByLabel("Name", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Close category editor" }).click();
  await expect(editor.getByPlaceholder("Search categories and items")).toHaveCSS("padding-left", "40px");
  await category.locator(".menu-category-group__toggle").click();
  await expect(category.locator(".menu-category-group__toggle")).toHaveAttribute("aria-expanded", "false");
  await editor.getByPlaceholder("Search categories and items").fill("missing category");
  await expect(editor.getByText("No results found")).toBeVisible();
  await editor.getByPlaceholder("Search categories and items").fill("");
  await editor.getByRole("combobox", { name: "Filter category visibility" }).selectOption("hidden");
  await expect(editor.getByText("No results found")).toBeVisible();
  await editor.getByRole("combobox", { name: "Filter category visibility" }).selectOption("all");

  const clippedDesktopLabels = await workflow.locator("button").evaluateAll((buttons) => buttons.filter((button) => {
    const label = button.querySelector<HTMLElement>(".menu-editor-tab-copy strong");
    if (!label) return true;
    const buttonBounds = button.getBoundingClientRect();
    const labelBounds = label.getBoundingClientRect();
    return labelBounds.left < buttonBounds.left || labelBounds.right > buttonBounds.right
      || label.scrollWidth > label.clientWidth + 1;
  }).length);
  expect(clippedDesktopLabels).toBe(0);

  await expect(workflow.getByRole("button", { name: /Items/ })).toHaveCount(0);
  await editor.locator(".menu-unified-toolbar").getByRole("button", { name: "Add item", exact: true }).click();
  await expect(editor.locator(".menu-unified-side .menu-product-editor")).toBeVisible();
  await category.locator(".menu-category-group__edit").first().click();
  await expect(editor.locator(".menu-unified-side .menu-category-editor")).toBeVisible();
  await editor.getByRole("button", { name: "Close category editor" }).click();

  const workflowBeforeDesign = await workflow.boundingBox();
  await workflow.getByRole("button", { name: /Design/ }).click();
  await expect(editor.locator(".menu-publish-tools")).toHaveCount(0);
  const designSettings = editor.locator(".menu-design-settings");
  const designPreview = editor.locator(".menu-design-preview");
  await expect(designPreview.locator('.admin-preview-device--mobile')).toBeVisible();
  await expect(designPreview.locator('[data-preview-source-width="390"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await expect(canvas.locator(".admin-menu-live-preview")).toHaveCount(0);
  const workflowInDesign = await workflow.boundingBox();
  const settingsBox = await designSettings.boundingBox();
  const previewBox = await designPreview.boundingBox();
  expect(workflowBeforeDesign && workflowInDesign && settingsBox && previewBox).toBeTruthy();
  expect(Math.abs(workflowInDesign!.x - workflowBeforeDesign!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(workflowInDesign!.y - workflowBeforeDesign!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(workflowInDesign!.width - workflowBeforeDesign!.width)).toBeLessThanOrEqual(1);
  expect(previewBox!.x).toBeGreaterThanOrEqual(settingsBox!.x + settingsBox!.width);
  expect(previewBox!.y).toBeGreaterThanOrEqual(workflowInDesign!.y + workflowInDesign!.height);
  await workflow.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(editor.locator(".menu-design-preview")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workflow.getByRole("button", { name: /Settings/ })).toBeVisible();
  await expect(workflow.getByRole("button", { name: /Design/ })).toBeVisible();
  await workflow.getByRole("button", { name: /Settings/ }).click();
  expect(await protrudingMenuContent(editor)).toEqual([]);
  await workflow.getByRole("button", { name: /Design/ }).click();
  await expect(designPreview.locator('.admin-preview-device--mobile')).toBeVisible();
  const mobileSettingsBox = await designSettings.boundingBox();
  const mobilePreviewBox = await designPreview.boundingBox();
  expect(mobileSettingsBox && mobilePreviewBox).toBeTruthy();
  expect(mobilePreviewBox!.y).toBeGreaterThanOrEqual(mobileSettingsBox!.y + mobileSettingsBox!.height);
  expect(await protrudingMenuContent(editor)).toEqual([]);
  await workflow.getByRole("button", { name: "Menu", exact: true }).click();
  await editor.getByRole("button", { name: "Add item" }).first().click();
  await expect(editor.locator(".menu-unified-panel")).toHaveClass(/is-editing/);
  await expect(editor.getByRole("button", { name: "Back to items" })).toBeVisible();
  await expect(editor.getByLabel("Item price")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Move up" })).toBeVisible();
  expect(await protrudingMenuContent(editor)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await editor.locator(".menu-product-editor").getByLabel("Name", { exact: true }).fill("Mobile menu item");
  await editor.getByRole("button", { name: "Back to items" }).click();
  await expect(editor.getByRole("button", { name: /Edit Mobile menu item/ })).toBeVisible();
  const itemGroup = editor.locator(".menu-category-group").first();
  await itemGroup.locator(".menu-category-group__toggle").first().click();
  await expect(itemGroup.locator(".menu-category-group__toggle").first()).toHaveAttribute("aria-expanded", "false");
  await expect(itemGroup.getByRole("button", { name: /Edit Mobile menu item/ })).toBeHidden();
  await itemGroup.locator(".menu-category-group__toggle").first().click();
  await editor.getByPlaceholder("Search categories and items").fill("no such item");
  await expect(editor.getByText("No results found")).toBeVisible();
  await editor.getByRole("button", { name: "Clear filters" }).click();
  await expect(editor.getByRole("button", { name: /Edit Mobile menu item/ })).toBeVisible();
  expect(await protrudingMenuContent(editor)).toEqual([]);
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);
});
