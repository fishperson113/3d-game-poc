import { expect, test } from "@playwright/test";

for (const size of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 900, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`fits ${size.name} viewport without page scrollbar`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building");
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
  });
}
