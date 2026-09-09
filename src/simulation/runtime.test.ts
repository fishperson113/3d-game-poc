import { beforeAll, describe, expect, it } from "vitest";
import { initializeRapier, RapierPhysicsWorld } from "../adapters/rapier/rapier-physics-world";
import { NamespacedEventBus } from "../kernel/events";
import { StaticPartCatalog } from "../parts";
import { createRuntimeFourWheelFixture } from "./fixtures/runtime-four-wheel";
import { SimulationCompiler } from "./application/simulation-compiler";
import type { RuntimeTelemetryEvent } from "./ports/runtime-telemetry";

describe("runtime four wheel physics", () => {
  beforeAll(async () => { await initializeRapier(); });

  it("moves, reverses and changes heading from wheel motors and steering servo", () => {
    const catalog = new StaticPartCatalog();
    const telemetry: RuntimeTelemetryEvent[] = [];
    const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld({ telemetry: (event) => telemetry.push(event) }) });
    const compiled = compiler.compile(createRuntimeFourWheelFixture(catalog));
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const world = compiled.value.world;
    for (let step = 0; step < 90; step += 1) { world.setControls({ throttle: 0, steering: 0 }); world.step(1 / 60); }
    const settled = world.snapshot().transforms.chassis;
    expect(settled).toBeDefined();
    expect(Math.abs(settled?.position[0] ?? 0)).toBeLessThan(0.15);
    expect(Math.abs(settled?.position[2] ?? 0)).toBeLessThan(0.15);
    expect(Math.hypot(settled?.rotation[0] ?? 0, settled?.rotation[2] ?? 0)).toBeLessThan(0.08);
    expect(telemetry.some((event) => event.type === "physics.collision.started" && JSON.stringify(event.payload).includes("environment.ground"))).toBe(true);
    world.setControls({ throttle: 1, steering: 0 });
    for (let step = 0; step < 180; step += 1) world.step(1 / 60);
    const driven = world.snapshot().transforms.chassis;
    expect(driven).toBeDefined();
    expect(Math.abs((driven?.position[2] ?? 0) - (settled?.position[2] ?? 0))).toBeGreaterThan(0.25);
    world.setControls({ throttle: 0, steering: 1 });
    for (let step = 0; step < 90; step += 1) world.step(1 / 60);
    const steered = world.snapshot().transforms.chassis;
    expect(steered).toBeDefined();
    expect(Math.abs(steered?.rotation[1] ?? 0)).toBeGreaterThan(0.02);
    world.setControls({ throttle: -1, steering: 0 });
    for (let step = 0; step < 180; step += 1) world.step(1 / 60);
    const reversed = world.snapshot().transforms.chassis;
    expect(reversed).toBeDefined();
    expect(Math.abs((reversed?.position[2] ?? 0) - (steered?.position[2] ?? 0))).toBeGreaterThan(0.12);
    world.dispose();
  });
});
