import { beforeAll, describe, expect, it } from "vitest";
import { initializeRapier, RapierPhysicsWorld } from "../../adapters/rapier/rapier-physics-world";
import { NamespacedEventBus } from "../../kernel/events";
import { StaticPartCatalog } from "../../parts";
import { Machine } from "../../building/domain/machine";
import { rootTransform } from "../../building/application/assembly-solver";
import { SimulationCompiler } from "../application/simulation-compiler";
import type { RuntimeTelemetryEvent } from "../ports/runtime-telemetry";
import { createRuntimeSampleFixture, RUNTIME_SAMPLES } from "./runtime-samples";

describe("runtime vehicle samples", () => {
  beforeAll(async () => { await initializeRapier(); });

  it("builds every sample through authoritative sockets and compiles physics", () => {
    const catalog = new StaticPartCatalog();
    const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });
    const expectedWheels = new Map(RUNTIME_SAMPLES.map((sample) => [sample.id, sample.wheels]));

    for (const sample of RUNTIME_SAMPLES) {
      const blueprint = createRuntimeSampleFixture(catalog, sample.id);
      const compiled = compiler.compile(blueprint);
      expect(compiled.ok, sample.id).toBe(true);
      expect(blueprint.parts.filter((part) => part.definitionId === "core.powered-wheel")).toHaveLength(expectedWheels.get(sample.id) ?? 0);
      expect(blueprint.parts.filter((part) => part.definitionId === "core.steering-hinge")).toHaveLength(2);
      expect(blueprint.connections.length).toBe(blueprint.parts.length - 1);
      if (sample.id !== "four-wheel-scout") {
        const chassis = blueprint.parts.find((part) => part.id === "chassis");
        const middle = blueprint.parts.find((part) => part.id === "frame-middle");
        expect(chassis?.transform.position[2]).not.toBe(middle?.transform.position[2]);
      }
      if (sample.id === "eight-wheel-crawler") {
        const middle = blueprint.parts.find((part) => part.id === "frame-middle");
        const tail = blueprint.parts.find((part) => part.id === "frame-tail");
        expect(middle?.transform.position[2]).not.toBe(tail?.transform.position[2]);
      }
      if (compiled.ok) compiled.value.world.dispose();
    }
  });

  it("allows a single structural core as an incomplete sandbox machine", () => {
    const catalog = new StaticPartCatalog();
    const created = Machine.create("runtime-core-only", { resolvePart: (definitionId) => catalog.get(definitionId) });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const added = created.value.addPart({ id: "core", definitionId: "core.structural-block", transform: rootTransform() });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });
    const compiled = compiler.compile(created.value.blueprint);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.value.specification.actuators).toHaveLength(0);
      compiled.value.world.dispose();
    }
  });

  it("drives and steers each runtime sample through Rapier", () => {
    const catalog = new StaticPartCatalog();
    const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });
    for (const sample of RUNTIME_SAMPLES) {
      const compiled = compiler.compile(createRuntimeSampleFixture(catalog, sample.id));
      expect(compiled.ok, sample.id).toBe(true);
      if (!compiled.ok) continue;
      const world = compiled.value.world;
      for (let step = 0; step < 15; step += 1) world.step(1 / 60);
      const before = world.snapshot().transforms.chassis;
      world.setControls({ throttle: 1, steering: 1 });
      for (let step = 0; step < 180; step += 1) world.step(1 / 60);
      const after = world.snapshot().transforms.chassis;
      expect(Math.hypot((after?.position[0] ?? 0) - (before?.position[0] ?? 0), (after?.position[2] ?? 0) - (before?.position[2] ?? 0)), sample.id).toBeGreaterThan(0.05);
      expect(Math.abs(after?.rotation[1] ?? 0), sample.id).toBeGreaterThan(0.005);
      world.dispose();
    }
  });

  it("keeps every sample grounded during startup without contact bounce", () => {
    const catalog = new StaticPartCatalog();
    for (const sample of RUNTIME_SAMPLES) {
      const telemetry: RuntimeTelemetryEvent[] = [];
      const startupCompiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld({ telemetry: (event) => telemetry.push(event) }) });
      const compiled = startupCompiler.compile(createRuntimeSampleFixture(catalog, sample.id));
      expect(compiled.ok, sample.id).toBe(true);
      if (!compiled.ok) continue;
      const world = compiled.value.world;
      for (let step = 0; step < 15; step += 1) world.step(1 / 60);
      const chassis = world.snapshot().transforms.chassis;
      expect(chassis?.position[1], sample.id).toBeGreaterThan(0.55);
      expect(Math.hypot(chassis?.position[0] ?? 0, chassis?.position[2] ?? 0), sample.id).toBeLessThan(0.2);
      expect(Math.hypot(chassis?.rotation[0] ?? 0, chassis?.rotation[2] ?? 0), sample.id).toBeLessThan(0.08);
      expect(telemetry.filter((event) => event.type === "physics.collision.stopped")).toHaveLength(0);
      world.dispose();
    }
  });
});
