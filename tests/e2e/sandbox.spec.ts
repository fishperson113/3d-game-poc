import { expect, test, type Page } from "@playwright/test";

const palette = (partId: string) => `button[data-action="palette"][data-part-id="${partId}"]`;

async function place(page: Page, partId: string): Promise<void> {
  await page.locator(palette(partId)).click();
  if (partId === "core.structural-block" && await page.locator('[data-role="placement-actions"]').evaluate((element) => getComputedStyle(element).display === "none")) {
    await expect(page.locator('[data-role="feedback"]')).toContainText("placed as the root");
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

async function rootPosition(page: Page): Promise<number[]> {
  return JSON.parse((await page.locator("#app").getAttribute("data-physics-root-position")) ?? "[0, 0, 0]") as number[];
}

async function rootRotation(page: Page): Promise<number[]> {
  return JSON.parse((await page.locator("#app").getAttribute("data-physics-root-rotation")) ?? "[0, 0, 0, 1]") as number[];
}

async function partRotation(page: Page, partId: string): Promise<number[]> {
  const raw = JSON.parse((await page.locator("#app").getAttribute("data-physics-transforms")) ?? "{}") as Record<string, { rotation?: number[] }>;
  return raw[partId]?.rotation ?? [0, 0, 0, 1];
}

function yawFromQuaternion(value: number[]): number {
  const x = value[0] ?? 0;
  const y = value[1] ?? 0;
  const z = value[2] ?? 0;
  const w = value[3] ?? 1;
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
}

function angleDelta(left: number, right: number): number {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
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
  await expect(page.locator('[data-role="assembly-guide"]')).toContainText("Click Steering hinge");
  await page.locator(palette("core.steering-hinge")).click();
  await expect(page.locator('[data-role="placement-label"]')).toContainText("block-1:mount-front-left");
  await expect(page.locator('[data-role="assembly-guide"]')).toContainText("hinge.mount");
  await page.locator('[data-action="confirm-placement"]').click();
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

  for (let cycle = 0; cycle < 100; cycle += 1) {
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

test("loads selectable six and eight wheel samples", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const sampleSelect = page.locator('[data-role="sample-select"]');
  await expect(sampleSelect.locator("option")).toHaveCount(3);

  await sampleSelect.selectOption("six-wheel-hauler");
  await page.locator('[data-action="sample"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText("Six-wheel hauler loaded");
  const sixWheelBlueprint = JSON.parse(await blueprintJson(page)) as { parts: Array<{ definitionId: string }> };
  expect(sixWheelBlueprint.parts.filter((part) => part.definitionId === "core.powered-wheel")).toHaveLength(6);
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  const sixBefore = await rootPosition(page);
  const sixRootBefore = await rootRotation(page);
  const sixWheelBefore = await partRotation(page, "hinge-front-left");
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.down("d");
  await page.waitForTimeout(600);
  const sixControls = controlsJson(await page.locator("#app").getAttribute("data-physics-controls"));
  const sixAfter = await rootPosition(page);
  const sixRotation = await rootRotation(page);
  const sixWheelAfter = await partRotation(page, "hinge-front-left");
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  expect(sixControls).toMatchObject({ throttle: 1, steering: 1 });
  expect(Math.hypot((sixAfter.at(0) ?? 0) - (sixBefore.at(0) ?? 0), (sixAfter.at(2) ?? 0) - (sixBefore.at(2) ?? 0))).toBeGreaterThan(0.05);
  expect(Math.abs(sixRotation.at(1) ?? 0)).toBeGreaterThan(0.005);
  expect(Math.hypot(...sixWheelAfter.map((value, index) => value - (sixWheelBefore[index] ?? 0)))).toBeGreaterThan(0.005);
  expect(Math.abs(angleDelta(yawFromQuaternion(sixWheelAfter) - yawFromQuaternion(sixRotation), yawFromQuaternion(sixWheelBefore) - yawFromQuaternion(sixRootBefore)))).toBeGreaterThan(0.05);
  await expect(page.locator('[data-role="events"]')).toContainText('"driveActuators":6');
  await expect(page.locator('[data-role="events"]')).toContainText('"steeringActuators":2');
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });

  await sampleSelect.selectOption("eight-wheel-crawler");
  await page.locator('[data-action="sample"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText("Eight-wheel crawler loaded");
  const eightWheelBlueprint = JSON.parse(await blueprintJson(page)) as { parts: Array<{ definitionId: string }> };
  expect(eightWheelBlueprint.parts.filter((part) => part.definitionId === "core.powered-wheel")).toHaveLength(8);
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  const eightBefore = await rootPosition(page);
  const eightRootBefore = await rootRotation(page);
  const eightWheelBefore = await partRotation(page, "hinge-front-left");
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.down("a");
  await page.waitForTimeout(600);
  const eightControls = controlsJson(await page.locator("#app").getAttribute("data-physics-controls"));
  const eightAfter = await rootPosition(page);
  const eightRotation = await rootRotation(page);
  const eightWheelAfter = await partRotation(page, "hinge-front-left");
  await page.keyboard.up("a");
  await page.keyboard.up("w");
  expect(eightControls).toMatchObject({ throttle: 1, steering: -1 });
  expect(Math.hypot((eightAfter.at(0) ?? 0) - (eightBefore.at(0) ?? 0), (eightAfter.at(2) ?? 0) - (eightBefore.at(2) ?? 0))).toBeGreaterThan(0.05);
  expect(Math.abs(eightRotation.at(1) ?? 0)).toBeGreaterThan(0.005);
  expect(Math.hypot(...eightWheelAfter.map((value, index) => value - (eightWheelBefore[index] ?? 0)))).toBeGreaterThan(0.005);
  expect(Math.abs(angleDelta(yawFromQuaternion(eightWheelAfter) - yawFromQuaternion(eightRotation), yawFromQuaternion(eightWheelBefore) - yawFromQuaternion(eightRootBefore)))).toBeGreaterThan(0.05);
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
});

test("allows starting with a single structural core for experimentation", async ({ page }) => {
  await page.goto("/");
  await place(page, "core.structural-block");
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  await expect(page.locator('[data-role="feedback"]')).toContainText("No drive actuator yet");
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
});

test("allows any palette part to start as a root experiment", async ({ page }) => {
  await page.goto("/");
  await page.locator(palette("core.powered-wheel")).click();
  await expect(page.locator('[data-role="feedback"]')).toContainText("wheel-1 placed as the root");
  const blueprint = JSON.parse(await blueprintJson(page)) as { parts: Array<{ id: string }> };
  expect(blueprint.parts.map((part) => part.id)).toEqual(["wheel-1"]);
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running", { timeout: 10_000 });
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building", { timeout: 10_000 });
});

test("recovers from frame and release faults without leaking the simulation lock", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="sample"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");
  await page.locator("#app").evaluate((host) => host.dispatchEvent(new CustomEvent("sandbox:test-fault", { detail: { phase: "frame" } })));
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Failed");
  await expect(page.locator("#app")).toHaveAttribute("data-active-physics-worlds", "0");
  await expect(page.locator("#app")).toHaveAttribute("data-active-input-listeners", "0");
  await page.locator('[data-action="retry"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");

  await page.locator("#app").evaluate((host) => host.dispatchEvent(new CustomEvent("sandbox:test-fault", { detail: { phase: "release" } })));
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Failed");
  await expect(page.locator('[data-role="events"]')).toContainText('"reason":"simulation.cleanup-failed"');
  await expect(page.locator('[data-role="events"]')).toContainText("building.simulation.snapshot-released");
  await page.locator('[data-action="retry"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Building");
  await expect(page.locator("#app")).toHaveAttribute("data-active-physics-worlds", "0");
});

test("waits for WebGL restoration before retrying", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="sample"]').click();
  await page.locator('[data-action="start"]').click();
  const canvas = page.locator("canvas.viewport-canvas");
  const supported = await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context") !== null);
  test.skip(!supported, "WEBGL_lose_context is unavailable");
  await canvas.evaluate((element) => {
    const extension = (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context");
    (window as typeof window & { __webglLoseContext: WEBGL_lose_context | undefined }).__webglLoseContext = extension ?? undefined;
    extension?.loseContext();
  });
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Failed");
  await expect(page.locator('[data-action="retry"]')).toBeDisabled();
  await canvas.evaluate(() => (window as typeof window & { __webglLoseContext: WEBGL_lose_context | undefined }).__webglLoseContext?.restoreContext());
  await expect(page.locator('[data-action="retry"]')).toBeEnabled({ timeout: 10_000 });
  await page.locator('[data-action="retry"]').click();
  await expect(page.locator('[data-role="runtime-state"]')).toHaveText("Running");
});
