import { expect, test, type Page } from "@playwright/test";

const palette = (partId: string) => `button[data-action="palette"][data-part-id="${partId}"]`;

async function place(page: Page, partId: string): Promise<void> {
  await page.locator(palette(partId)).click();
  if (partId === "core.structural-block" && await page.locator('[data-role="placement-actions"]').evaluate((element) => getComputedStyle(element).display === "none")) {
    await expect(page.locator('[data-role="feedback"]')).toContainText("Root block placed");
    return;
  }
  await expect(page.locator('[data-role="placement-actions"]')).toBeVisible();
  await expect(page.locator('[data-role="placement-label"]')).toContainText("valid");
  await page.locator('[data-action="confirm-placement"]').click();
  await expect(page.locator('[data-role="placement-actions"]')).toBeHidden();
}

async function blueprintJson(page: Page): Promise<string> {
  return (await page.locator("#app").getAttribute("data-blueprint-json")) ?? "";
}

async function physicsJson(page: Page): Promise<string> {
  return (await page.locator("#app").getAttribute("data-physics-specification-json")) ?? "";
}

test("self assembles, drives, resets, and runs the same blueprint with visual B variants", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building");

  await place(page, "core.structural-block");
  await place(page, "core.steering-hinge");
  await place(page, "core.steering-hinge");
  await place(page, "core.powered-wheel");
  await place(page, "core.powered-wheel");
  await place(page, "core.powered-wheel");
  await place(page, "core.powered-wheel");

  const assembledBlueprint = await blueprintJson(page);
  const parsed = JSON.parse(assembledBlueprint) as { parts: unknown[]; connections: unknown[]; controlBindings: unknown[] };
  expect(parsed.parts).toHaveLength(7);
  expect(parsed.connections).toHaveLength(6);
  expect(parsed.controlBindings).toHaveLength(6);

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");

  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
  await expect(page.locator("#app")).toHaveAttribute("data-active-physics-worlds", "0");
  await expect(page.locator("#app")).toHaveAttribute("data-active-input-listeners", "0");
  await page.locator('[data-role="viewport"]').screenshot({ path: "docs/evidence/plan04-visual-a.png" });

  const blueprintA = await blueprintJson(page);
  const physicsA = await physicsJson(page);
  expect(blueprintA).toBe(assembledBlueprint);
  expect(physicsA).toContain('"bodies"');

  for (const partId of ["core.structural-block", "core.powered-wheel", "core.steering-hinge"]) {
    await page.locator(`select[data-action="variant"][data-part-id="${partId}"]`).selectOption("B");
  }
  await expect(page.locator('[data-role="feedback"]')).toContainText("Visual B selected");
  await page.locator('[data-role="viewport"]').screenshot({ path: "docs/evidence/plan04-visual-b.png" });
  const geometryCount = await page.locator("#app").getAttribute("data-renderer-geometries");
  const textureCount = await page.locator("#app").getAttribute("data-renderer-textures");

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  const physicsB = await physicsJson(page);
  expect(await blueprintJson(page)).toBe(blueprintA);
  expect(physicsB).toBe(physicsA);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
    await expect(page.locator("#app")).toHaveAttribute("data-active-physics-worlds", "0");
    await page.locator('[data-action="start"]').click();
    await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  }
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
  await expect(page.locator("#app")).toHaveAttribute("data-active-physics-worlds", "0");
  await expect(page.locator("#app")).toHaveAttribute("data-active-input-listeners", "0");
  await expect(page.locator("#app")).toHaveAttribute("data-active-renderers", "1");
  await expect(page.locator("#app")).toHaveAttribute("data-renderer-geometries", geometryCount ?? "0");
  await expect(page.locator("#app")).toHaveAttribute("data-renderer-textures", textureCount ?? "0");
  await expect(page.locator("#app")).toHaveAttribute("data-active-raf-owners", "1");
});
