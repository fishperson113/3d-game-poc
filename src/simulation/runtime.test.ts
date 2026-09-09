import { beforeAll, describe, expect, it } from "vitest";
import { initializeRapier, RapierPhysicsWorld } from "../adapters/rapier/rapier-physics-world";
import { NamespacedEventBus } from "../kernel/events";
import { StaticPartCatalog } from "../parts";
import { createRuntimeFourWheelFixture } from "./fixtures/runtime-four-wheel";
import { SimulationCompiler } from "./application/simulation-compiler";

describe("runtime four wheel physics", () => {
  beforeAll(async () => { await initializeRapier(); });

  it("moves, reverses and changes heading from wheel motors and steering servo", () => {
    const catalog = new StaticPartCatalog();
    const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });
    const compiled = compiler.compile(createRuntimeFourWheelFixture(catalog));
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const world = compiled.value.world;
    for (let step = 0; step < 90; step += 1) { world.setControls({ throttle: 0, steering: 0 }); world.step(1 / 60); }
    const settled = world.snapshot().transforms.chassis;
    expect(settled).toBeDefined();
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
