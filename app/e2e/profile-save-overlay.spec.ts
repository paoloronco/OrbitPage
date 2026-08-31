import { expect, test } from "@playwright/test";

import { openAuthenticatedAdmin } from "./helpers";

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

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
  const floatingActions = page.locator(".admin-profile-save-float");
  await expect(layer).toHaveCSS("position", "fixed");
  const desktopBeforeScroll = await layer.boundingBox();
  expect(desktopBeforeScroll).not.toBeNull();
  const desktopActions = await floatingActions.boundingBox();
  expect(desktopActions).not.toBeNull();
  expect(Math.abs(desktopActions!.x + (desktopActions!.width / 2) - 640)).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const desktopAfterScroll = await layer.boundingBox();
  expect(desktopAfterScroll).not.toBeNull();
  expect(Math.abs(desktopAfterScroll!.x - desktopBeforeScroll!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktopAfterScroll!.y - desktopBeforeScroll!.y)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.evaluate(() => {
    const chatbot = document.createElement("button");
    chatbot.className = "saas-ai-agent";
    chatbot.setAttribute("aria-label", "Test chatbot bubble");
    Object.assign(chatbot.style, {
      bottom: "24px",
      height: "46px",
      position: "fixed",
      right: "24px",
      width: "168px",
    });
    document.body.append(chatbot);
  });
  const chatbot = page.getByRole("button", { name: "Test chatbot bubble" });
  const tabletActionsBounds = await floatingActions.boundingBox();
  const tabletChatbotBounds = await chatbot.boundingBox();
  expect(tabletActionsBounds).not.toBeNull();
  expect(tabletChatbotBounds).not.toBeNull();
  expect(rectanglesOverlap(tabletActionsBounds!, tabletChatbotBounds!)).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await chatbot.evaluate((element) => Object.assign((element as HTMLElement).style, {
    bottom: "12px",
    height: "48px",
    right: "12px",
    width: "48px",
  }));
  const mobileSaveBounds = await save.boundingBox();
  const mobileActionsBounds = await floatingActions.boundingBox();
  const chatbotBounds = await chatbot.boundingBox();
  expect(mobileSaveBounds).not.toBeNull();
  expect(mobileActionsBounds).not.toBeNull();
  expect(chatbotBounds).not.toBeNull();
  expect(mobileSaveBounds!.height).toBeGreaterThanOrEqual(44);
  expect(mobileSaveBounds!.x + mobileSaveBounds!.width).toBeLessThanOrEqual(390);
  expect(rectanglesOverlap(mobileActionsBounds!, chatbotBounds!)).toBe(false);

  await save.click();
  await expect(save).toBeHidden();

  const notice = page.locator(".admin-profile-saved-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Saved");
  await expect(notice).toContainText("visible on the public page in about 10 seconds");
  await expect(notice.locator(".admin-profile-saved-notice__progress > i")).toHaveCSS("animation-duration", "8s");
  const noticeBounds = await notice.boundingBox();
  expect(noticeBounds).not.toBeNull();
  expect(rectanglesOverlap(noticeBounds!, chatbotBounds!)).toBe(false);

  await notice.getByRole("button", { name: "Revert" }).click();
  await expect(pageName).toHaveValue(originalName);
  await expect(notice).toBeHidden();
  await expect(save).toBeHidden();
});
