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
  await page.getByRole("button", { name: "Save page" }).click();
  const profileTarget = page.locator('[data-public-editor-target="profile"]');
  await expect(profileTarget).toBeVisible();
  await profileTarget.click();
  await expect(profileTarget).toHaveClass(/is-selected/);
  const profileSelectionIndicator = await profileTarget.evaluate((element) => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    selectionAnimation: getComputedStyle(element, "::before").animationName,
    selectionDuration: getComputedStyle(element, "::before").animationDuration,
    selectionBorderWidth: getComputedStyle(element, "::before").borderTopWidth,
    selectionInset: getComputedStyle(element, "::before").inset,
  }));
  expect(profileSelectionIndicator).toEqual({
    outlineStyle: "none",
    selectionAnimation: "visual-editor-selection-breathe",
    selectionDuration: "2.2s",
    selectionBorderWidth: "3px",
    selectionInset: "-6px",
  });
  await expect(inspector.getByRole("heading", { name: "Profile and identity" })).toBeVisible();
  await expect(inspector.getByLabel("Page name")).toBeVisible();

  const selectedLinkTarget = page.locator(`[data-public-editor-link-id="${linkId}"]`);
  await selectedLinkTarget.click();
  await expect(selectedLinkTarget).toHaveClass(/is-selected/);
  await expect(profileTarget).not.toHaveClass(/is-selected/);
  await expect(inspector.getByRole("heading", { name: "Visual editor card", exact: true }).first()).toBeVisible();
  await expect(inspector.getByPlaceholder("Link title")).toHaveValue("Visual editor card");
  await expect(inspector.getByPlaceholder("https://example.com", { exact: true })).toHaveValue("https://example.com/visual-editor");

  const selectionMotion = await selectedLinkTarget.evaluate((element) => {
    const animation = element.getAnimations({ subtree: true })
      .find((candidate) => candidate instanceof CSSAnimation
        && candidate.animationName === "visual-editor-selection-breathe");
    const keyframes = animation?.effect instanceof KeyframeEffect
      ? animation.effect.getKeyframes()
      : [];
    const opacityValues = keyframes
      .map((frame) => Number(frame.opacity))
      .filter(Number.isFinite);
    return {
      keyframeCount: keyframes.length,
      opacityRange: opacityValues.length > 1
        ? Math.max(...opacityValues) - Math.min(...opacityValues)
        : 0,
      shadowCount: new Set(keyframes.map((frame) => String(frame.boxShadow))).size,
      scaleRange: (() => {
        const scales = keyframes
          .map((frame) => Number(String(frame.transform).match(/scale\(([^)]+)\)/)?.[1]))
          .filter(Number.isFinite);
        return scales.length > 1 ? Math.max(...scales) - Math.min(...scales) : 0;
      })(),
      transforms: keyframes.map((frame) => String(frame.transform)),
    };
  });
  expect(selectionMotion.keyframeCount).toBe(2);
  expect(selectionMotion.opacityRange).toBe(0);
  expect(selectionMotion.shadowCount).toBe(2);
  expect(selectionMotion.scaleRange).toBeGreaterThanOrEqual(.02);
  expect(new Set(selectionMotion.transforms).size).toBe(2);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionIndicator = await selectedLinkTarget.evaluate((element) => {
    const outlineStyle = getComputedStyle(element);
    const selectionStyle = getComputedStyle(element, "::before");
    return {
      outlineStyle: outlineStyle.outlineStyle,
      selectionAnimation: selectionStyle.animationName,
      selectionDuration: selectionStyle.animationDuration,
      selectionIterations: selectionStyle.animationIterationCount,
      selectionBorderWidth: selectionStyle.borderTopWidth,
      selectionOpacity: selectionStyle.opacity,
    };
  });
  expect(reducedMotionIndicator).toEqual({
    outlineStyle: "none",
    selectionAnimation: "visual-editor-selection-breathe",
    selectionDuration: "2.2s",
    selectionIterations: "infinite",
    selectionBorderWidth: "3px",
    selectionOpacity: "1",
  });

  await inspector.getByRole("button", { name: "Delete card" }).click();
  await expect(selectedLinkTarget).toHaveCount(0);
  await inspector.locator(".admin-link-manager--visual > .admin-link-toolbar .admin-link-actions").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved changes")).toBeHidden();

  await page.locator(".public-page-root--editor").dispatchEvent("click");
  await expect(page.locator(".visual-site-editor")).toBeHidden();
  await expect(page.locator(".admin-theme-customizer")).toBeVisible();

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
  await expect(topbarPublicPage).toHaveAccessibleName("Public page");
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

test("New UI gives Menu a focused inspector without clipped labels", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.addInitScript(() => window.localStorage.setItem("orbitpage.admin.new-ui", "true"));
  await openAuthenticatedAdmin(page);

  await page.getByRole("navigation", { name: "Site sections" }).getByRole("button", { name: "Menu", exact: true }).click();

  const inspector = page.locator(".visual-site-editor__inspector");
  const editor = inspector.locator(".menu-editor-stack--visual");
  const workflow = editor.getByRole("navigation", { name: "Menu setup workflow" });
  const canvas = page.locator(".visual-site-editor__canvas");
  await expect(editor).toBeVisible();
  await expect(canvas.locator(".admin-menu-live-preview .orbitpage-menu--embedded")).toBeVisible();
  await expect(canvas.locator(".admin-live-preview")).toHaveCount(0);
  await expect(workflow).toBeVisible();
  await expect(workflow.getByRole("button")).toHaveCount(4);
  await expect(editor.getByText("Pro menu", { exact: true })).toHaveCount(0);
  await expect(inspector.getByText("Selected element", { exact: true })).toHaveCount(0);
  await expect(editor.locator(".menu-visual-context")).toHaveCount(0);
  await expect(editor.locator(".menu-content-pane--sections")).toBeVisible();
  await expect(editor.locator(".menu-content-pane--products")).toBeHidden();
  await expect(editor.locator(".menu-category-accordion")).toHaveCount(0);
  await expect(editor.locator(".menu-category-editor")).toHaveCount(1);

  const clippedDesktopLabels = await workflow.locator("button").evaluateAll((buttons) => buttons.filter((button) => {
    const label = button.querySelector<HTMLElement>(".menu-editor-tab-copy strong");
    if (!label) return true;
    const buttonBounds = button.getBoundingClientRect();
    const labelBounds = label.getBoundingClientRect();
    return labelBounds.left < buttonBounds.left || labelBounds.right > buttonBounds.right
      || label.scrollWidth > label.clientWidth + 1;
  }).length);
  expect(clippedDesktopLabels).toBe(0);

  await workflow.getByRole("button", { name: /Items/ }).click();
  await expect(editor.locator(".menu-content-pane--sections")).toBeHidden();
  await expect(editor.locator(".menu-content-pane--products")).toBeVisible();
  await expect(editor.getByText("Selected item", { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workflow.getByRole("button", { name: /Identity/ })).toBeVisible();
  await expect(workflow.getByRole("button", { name: /Design/ })).toBeVisible();
  const mobileOverflow = await editor.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);
});
