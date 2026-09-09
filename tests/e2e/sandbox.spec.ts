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

function controlsJson(value: string | null): { throttle: number; steering: number } {
  const parsed: unknown = JSON.parse(value ?? "{}");
  if (typeof parsed !== "object" || parsed === null) return { throttle: 0, steering: 0 };
  const record = parsed as Record<string, unknown>;
  return {
    throttle: typeof record.throttle === "number" ? record.throttle : 0,
    steering: typeof record.steering === "number" ? record.steering : 0,
  };
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
  const targetSockets = (parsed.connections as Array<{ a: { partId: string; socketId: string }; b: { partId: string; socketId: string } }>)
    .filter((connection) => connection.a.partId.startsWith("wheel-") || connection.b.partId.startsWith("wheel-"))
    .map((connection) => connection.a.partId.startsWith("wheel-") ? connection.b : connection.a)
    .map((socket) => `${socket.partId}:${socket.socketId}`)
    .sort();
  expect(targetSockets).toEqual(["block-1:mount-rear-left", "block-1:mount-rear-right", "hinge-1:axle", "hinge-2:axle"].sort());

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  await page.waitForTimeout(250);
  const beforeDrive = JSON.parse((await page.locator("#app").getAttribute("data-physics-root-position")) ?? "[0, 0, 0]") as number[];
  await page.keyboard.down("w");
  await page.waitForTimeout(1800);
  const controlsDuringDrive = controlsJson(await page.locator("#app").getAttribute("data-physics-controls"));
  await page.keyboard.down("d");
  await page.waitForTimeout(900);
  const controlsDuringSteer = controlsJson(await page.locator("#app").getAttribute("data-physics-controls"));
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");
  expect(controlsDuringDrive.throttle).toBe(1);
  expect(controlsDuringSteer.throttle).toBe(1);
  expect(controlsDuringSteer.steering).toBe(1);
  const eventFilter = page.locator('[data-role="event-filter"]');
  await eventFilter.fill("input.control");
  await expect(page.locator('[data-role="events"]')).toContainText("input.control.changed");
  await eventFilter.fill("physics.collision");
  await expect(page.locator('[data-role="events"]')).toContainText("physics.collision.started");
  await eventFilter.fill("");
  const afterDrive = JSON.parse((await page.locator("#app").getAttribute("data-physics-root-position")) ?? "[0, 0, 0]") as number[];
  expect(afterDrive.every(Number.isFinite)).toBe(true);
  expect(Math.hypot((afterDrive.at(0) ?? 0) - (beforeDrive.at(0) ?? 0), (afterDrive.at(2) ?? 0) - (beforeDrive.at(2) ?? 0))).toBeGreaterThan(0.1);

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
