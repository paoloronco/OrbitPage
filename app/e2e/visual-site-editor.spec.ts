import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSWORD, contentSaveButton, openAuthenticatedAdmin, openPreviewContentCard, preservePageData, saveEditorChanges } from "./helpers";

async function startIsolatedLayoutPage(page: Page) {
  const restore = await preservePageData(page);
  const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  const profile = await (await page.request.get('/api/profile', { headers })).json();
  // Earlier tests can accumulate cards beyond the layout's 4,000 px editing bound.
  expect((await page.request.put('/api/profile', { headers, data: { ...profile, appearance: {} } })).ok()).toBeTruthy();
  expect((await page.request.put('/api/links', { headers, data: [] })).ok()).toBeTruthy();
  await page.reload();
  return restore;
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

test("Site section navigation stays in place across Page, Content, Menu, Shop and Pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const sections = page.getByRole("navigation", { name: "Site sections" });
  const geometry = () => sections.evaluate((navigation) => {
    const bounds = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      navigation: bounds(navigation),
      buttons: [...navigation.querySelectorAll(":scope > button")].map(bounds),
    };
  });
  const measurements = [];
  for (const label of ["Page", "Content", "Menu", "Shop", "Pages"]) {
    await sections.getByRole("button", { name: label, exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (label === "Shop") {
      await expect(page.locator('[data-orbitpage-shop-preview-device-slot]').getByRole("group", { name: "Preview device" })).toBeVisible();
      await expect(page.locator('.shop-workspace .shop-preview-device-toolbar')).toHaveCount(0);
    }
    measurements.push({ label, ...(await geometry()) });
  }
  for (const measurement of measurements.slice(1)) {
    expect(measurement.navigation).toEqual(measurements[0].navigation);
    expect(measurement.buttons).toEqual(measurements[0].buttons);
  }
});

test("Site section navigation keeps its size on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  const sections = page.getByRole("navigation", { name: "Site sections" });
  const geometry = () => sections.evaluate((navigation) => {
    const { x, y, width, height } = navigation.getBoundingClientRect();
    return {
      x, y, width, height,
      buttonSizes: [...navigation.querySelectorAll(":scope > button")].map((button) => {
        const bounds = button.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    };
  });
  const measurements = [];
  for (const label of ["Page", "Content", "Menu", "Shop", "Pages"]) {
    await sections.getByRole("button", { name: label, exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    measurements.push(await geometry());
  }
  for (const measurement of measurements.slice(1)) expect(measurement).toEqual(measurements[0]);
});

test("Visual editor persists profile and content selected on the real preview", async ({ browserName, page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const pageName = `Visual editor ${browserName} ${Date.now()}`;
  const cardName = `${pageName} saved card`;
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
  await editor.getByPlaceholder("Link title").fill(cardName);
  await editor.getByPlaceholder("https://example.com", { exact: true }).fill("https://example.com/visual-editor");
  await expect(card).toContainText(cardName);
  await saveEditorChanges(page);

  await page.reload();
  const savedCard = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${id}"]`);
  const { editor: savedEditor } = await openPreviewContentCard(page, savedCard);
  await expect(savedEditor.getByPlaceholder("Link title")).toHaveValue(cardName);
  await expect(savedEditor.getByPlaceholder("https://example.com", { exact: true })).toHaveValue("https://example.com/visual-editor");
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await expect(inspector.getByLabel("Page name")).toHaveValue(pageName);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: pageName, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `Open ${cardName}`, exact: true })).toHaveAttribute("href", "https://example.com/visual-editor");
});

test("Arrange exposes profile elements alongside whole-card controls and continuous resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await startIsolatedLayoutPage(page);
  try {
    await page.getByRole("textbox", { name: "Role or focus" }).fill(`Work ${Date.now()}`);
    await page.getByRole("textbox", { name: "Location" }).fill("Turin");
    await contentSaveButton(page).click();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: "Add content" }).click();
    await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
    await contentSaveButton(page).click();

    await page.getByRole("button", { name: "Arrange", exact: true }).click();
    await expect(page.getByRole('button', { name: 'Move Work', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move Location', exact: true })).toBeVisible();
    await expect(page.locator("[data-profile-layout-mode], [data-card-layout-mode]")).toHaveCount(0);
    const contentCard = page.locator('[data-card-layout-item]:not([data-card-layout-item="orbitpage-profile"])').last();
    const moveHandle = contentCard.getByRole("button", { name: /^Move card/ });
    const handleBounds = await moveHandle.boundingBox();
    expect(handleBounds).not.toBeNull();
    expect(await moveHandle.evaluate((element) => Number.parseFloat(getComputedStyle(element).width))).toBe(64);

    const originalWidth = Number((await contentCard.getAttribute("data-card-layout-position"))!.split(",")[2]);
    await contentCard.getByRole("button", { name: /^Resize card/ }).press("ArrowRight");
    await expect.poll(async () => {
      const resized = (await contentCard.getAttribute("data-card-layout-position"))!.split(",").map(Number);
      return resized[2] > originalWidth && resized[2] < originalWidth + 1;
    }).toBe(true);

    await contentSaveButton(page).click();
    await page.getByRole("button", { name: "Arrange", exact: true }).click();
    await expect(page.locator("[data-profile-layout-mode], [data-card-layout-mode]")).toHaveCount(0);
  } finally {
    await restore();
  }
});

test("Arrange still lets image cards open their editor, update the image, and delete", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await startIsolatedLayoutPage(page);
  try {
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: "Add content" }).click();
    const library = page.getByRole("dialog", { name: "Add content" });
    await library.getByRole("button", { name: /Media & embeds/ }).click();
    await library.getByRole("button", { name: /^Image\b/ }).click();

    const inspector = page.locator(".visual-site-editor__inspector");
    await inspector.getByPlaceholder("Image title (optional)").fill("Arrange image test");
    const imageUrl = "https://example.invalid/image.png";
    await inspector.getByPlaceholder("https://example.com/image.jpg").fill(imageUrl);
    await contentSaveButton(page).click();

    const card = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
    await expect(card).toBeVisible();
    await page.getByRole("button", { name: "Arrange", exact: true }).click();
    await card.click();

    await expect(page.getByRole("button", { name: "Content", exact: true })).toHaveAttribute("aria-current", "page");
    const imageInput = inspector.getByRole("textbox", { name: "Cover Image", exact: true });
    await expect(imageInput).toHaveValue(imageUrl);
    await imageInput.fill("https://example.invalid/updated-image.png");
    await contentSaveButton(page).click();
    await expect(imageInput).toHaveValue("https://example.invalid/updated-image.png");
    await page.getByRole("button", { name: "Delete card", exact: true }).click();
    await expect(card).toHaveCount(0);
  } finally {
    await restore();
  }
});

test("card resize returns to its default width and Revert restores Arrange", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await startIsolatedLayoutPage(page);
  try {
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
    const screenWidth = await page.locator('.public-card-stack--layout').evaluate(element => element.getBoundingClientRect().width);
    await expect.poll(async () => Math.abs(await width() - 50) / 100 * screenWidth).toBeLessThanOrEqual(1);
    await dragToWidth(defaultWidth);
    await expect.poll(async () => Math.abs(await width() - defaultWidth) / 100 * screenWidth).toBeLessThanOrEqual(1);

    await resize.press("ArrowRight");
    await page.locator(".admin-profile-save-float").getByRole("button", { name: "Revert" }).click();
    await page.getByRole("button", { name: "Arrange", exact: true }).click();
    await expect.poll(width).toBe(defaultWidth);
  } finally { await restore(); }
});

test("Arrange keeps long card text in its original alignment and full width", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await startIsolatedLayoutPage(page);
  try {
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: "Add content" }).click();
    await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
    await saveEditorChanges(page);
    const preview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
    const { editor, id } = await openPreviewContentCard(page, preview);
    await editor.getByPlaceholder("Link title").fill("A long card title that uses all the available width and wraps onto more than one line");
    await editor.getByPlaceholder("Block description").fill("A complete description with useful details for visitors. ".repeat(5));
    await editor.getByLabel("Alignment", { exact: true }).click();
    await page.getByRole("option", { name: "Right", exact: true }).click();
    await saveEditorChanges(page);
    const textBounds = () => preview.locator('[data-card-content-layout-item="title"] h3').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width, height: rect.height, align: getComputedStyle(element).textAlign, clamp: getComputedStyle(element).webkitLineClamp };
    });
    const before = await textBounds();
    await page.getByRole("button", { name: "Arrange", exact: true }).click();
    const card = page.locator(`[data-card-layout-item="${id}"]`);
    const after = await card.locator('h3').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width, height: rect.height, align: getComputedStyle(element).textAlign, clamp: getComputedStyle(element).webkitLineClamp };
    });
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.width - before.width)).toBeLessThan(2);
    expect(Math.abs(after.height - before.height)).toBeLessThan(2);
    expect(after.align).toBe(before.align);
    expect(after.clamp).toBe("none");
    const resize = card.getByRole("button", { name: /^Resize card/ });
    await resize.press("ArrowLeft");
    await resize.press("ArrowLeft");
    await expect.poll(() => card.evaluate(element => {
      const title = element.querySelector('h3')!.getBoundingClientRect();
      const description = element.querySelector('[data-card-content-layout-item="description"]')!.getBoundingClientRect();
      return title.bottom <= description.top && description.bottom <= element.getBoundingClientRect().bottom;
    })).toBe(true);
    await resize.press("ArrowUp");
    await expect.poll(() => card.evaluate(element => element.querySelector('[data-card-content-layout-item="description"]')!.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom)).toBe(true);
    await card.getByRole("button", { name: /^Move card/ }).press("ArrowRight");
    await saveEditorChanges(page);
    await page.reload();
    await expect(page.locator(`[data-public-editor-link-id="${id}"] h3`)).toHaveText("A long card title that uses all the available width and wraps onto more than one line");
    await page.goto("/");
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const heading = page.getByRole("heading", { name: "A long card title that uses all the available width and wraps onto more than one line", exact: true }).last();
      await expect(heading).toHaveCSS("text-align", "right");
      await expect.poll(() => heading.evaluate(element => {
        const card = element.closest(".glass-card")!;
        const description = card.querySelector('[data-card-content-layout-item="description"]')!;
        const bounds = card.getBoundingClientRect();
        return element.scrollWidth <= element.clientWidth + 1
          && description.getBoundingClientRect().bottom <= bounds.bottom + 1
          && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
    }

  } finally {
    await restore();
  }
});

test("Visual editor keeps mobile navigation and destinations explicit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  const publicPage = page.locator("a.admin-dashboard-logo");
  await expect(publicPage).toBeVisible();
  await expect(publicPage).toHaveAccessibleName(/^Public page: \/.+/);
  await expect(page.locator('.admin-section-public-page')).toHaveCount(0);
  const publicUrl = new URL((await publicPage.getAttribute('href'))!, page.url()).href;
  const popupPromise = page.waitForEvent('popup');
  await publicPage.click();
  const publicTab = await popupPromise;
  await expect(publicTab).toHaveURL(publicUrl);
  await publicTab.close();
  const publicPageBounds = await publicPage.boundingBox();
  expect(publicPageBounds).not.toBeNull();
  expect(publicPageBounds!.height).toBeGreaterThanOrEqual(44);

  await expect(page.locator(".admin-dashboard-header, .admin-dashboard-mobile-public-page")).toHaveCount(0);
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
  await expect(publicPage).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  const compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(compactOverflow).toBeLessThanOrEqual(1);
});

test("Content buttons reorder selected cards only in the mobile preview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await page.getByRole("button", { name: "Content", exact: true }).click();
  const addLink = async () => {
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: "Add content" }).click();
    await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /^Link\b/ }).click();
    await contentSaveButton(page).click();
    return (await page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last().getAttribute('data-public-editor-link-id'))!;
  };
  const firstId = await addLink();
  const secondId = await addLink();
  const visibleOrder = () => page.locator('.visual-site-editor__canvas [data-public-editor-link-id]')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-public-editor-link-id')));
  expect((await visibleOrder()).slice(-2)).toEqual([firstId, secondId]);

  await page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${secondId}"]`).click();
  const actions = page.locator('.visual-site-editor__inspector-heading-actions');
  await actions.getByRole('button', { name: 'Move up' }).click();
  await expect.poll(async () => (await visibleOrder()).slice(-2)).toEqual([secondId, firstId]);
  await page.reload();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect.poll(async () => (await visibleOrder()).slice(-2)).toEqual([secondId, firstId]);
  await page.getByRole('button', { name: 'Desktop preview' }).click();
  await expect.poll(async () => (await visibleOrder()).slice(-2)).toEqual([firstId, secondId]);
  await page.getByRole('button', { name: 'Mobile preview' }).click();
  await page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${secondId}"]`).click();
  await actions.getByRole('button', { name: 'Move down' }).click();
  await expect.poll(async () => (await visibleOrder()).slice(-2)).toEqual([firstId, secondId]);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
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

test("Menu opens a mobile preview with a Personalize panel beside it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 }); await openAuthenticatedAdmin(page);
  await page.getByRole("navigation", { name: "Site sections" }).getByRole("button", { name: "Menu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Visual site editor" });
  await expect(editor.locator('.menu-preview-canvas')).toBeVisible();
  await expect(editor.locator('[data-preview-source-width="390"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await expect(editor.getByRole('navigation', { name: 'Menu setup workflow' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Personalize', exact: true }).click();
  const personalize = editor.getByRole('complementary', { name: 'Personalize menu', exact: true }); await expect(personalize).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await editor.locator('.menu-preview-workspace').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
