import { beforeAll, describe, expect, it } from "vitest";
import { initializeRapier, RapierPhysicsWorld } from "../adapters/rapier/rapier-physics-world";
import { createRuntimeSampleFixture, RUNTIME_SAMPLES } from "./fixtures/runtime-samples";
import { defaultSimulationEnvironment, SimulationCompiler } from "./application/simulation-compiler";
import { SimulationSession } from "./application/simulation-session";
import { NamespacedEventBus } from "../kernel/events";
import { StaticPartCatalog } from "../parts";
import { rotateVector, subtractVector, tupleDistance } from "../kernel/math";
import type { PhysicsSpecification, PhysicsWorld } from "./ports/physics-world";
import type { SimulationRenderer } from "./ports/simulation-renderer";
import type { InputSource } from "./ports/input-source";
import type { RuntimeTelemetryEvent } from "./ports/runtime-telemetry";

function compiler(createPhysicsWorld: () => PhysicsWorld): SimulationCompiler {
  return new SimulationCompiler({ catalog: new StaticPartCatalog(), events: new NamespacedEventBus(), createPhysicsWorld });
}

describe("runtime hardening", () => {
  beforeAll(async () => { await initializeRapier(); });

  it("applies environment.spawn to the complete assembly", () => {
    let captured: PhysicsSpecification | undefined;
    const world = { initialize: (value: PhysicsSpecification) => { captured = value; }, setControls: () => {}, step: () => {}, snapshot: () => ({ step: 0, transforms: {} }), getStats: () => ({ bodies: 0, joints: 0, steps: 0 }), dispose: () => {} } satisfies PhysicsWorld;
    const catalog = new StaticPartCatalog();
    const blueprint = createRuntimeSampleFixture(catalog, "four-wheel-scout");
    const environment = { ...defaultSimulationEnvironment(), spawn: [4, 3, -2] as const };
    const result = compiler(() => world).compile(blueprint, environment);
    expect(result.ok).toBe(true);
    const root = captured?.bodies.find((body) => body.id === "chassis");
    expect(root?.transform.position).toEqual(environment.spawn);
    const originalWheel = blueprint.parts.find((part) => part.id === "wheel-rear-left");
    const spawnedWheel = captured?.bodies.find((body) => body.id === "wheel-rear-left");
    const spawnedOffset = subtractVector(spawnedWheel?.transform.position ?? [0, 0, 0], root?.transform.position ?? [0, 0, 0]);
    const originalOffset = subtractVector(originalWheel?.transform.position ?? [0, 0, 0], blueprint.parts[0]?.transform.position ?? [0, 0, 0]);
    spawnedOffset.forEach((value, index) => { expect(value).toBeCloseTo(originalOffset[index] ?? 0, 10); });
  });

  it("rejects unintended collider overlap before allocating a world", () => {
    const catalog = new StaticPartCatalog();
    const blueprint = createRuntimeSampleFixture(catalog, "four-wheel-scout");
    const parts = blueprint.parts.map((part) => part.id === "wheel-front-left" ? { ...part, transform: { ...part.transform, position: [0, 0.75, 0] as const } } : part);
    let allocations = 0;
    const result = compiler(() => { allocations += 1; return new RapierPhysicsWorld(); }).compile({ ...blueprint, parts });
    expect(result).toMatchObject({ ok: false, error: { code: "simulation.compile.collider-overlap" } });
    expect(allocations).toBe(0);
  });

  it("keeps every sample finite with bounded joint-anchor drift under long mixed controls", () => {
    const catalog = new StaticPartCatalog();
    for (const sample of RUNTIME_SAMPLES) {
      const result = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() }).compile(createRuntimeSampleFixture(catalog, sample.id));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const { world, specification } = result.value;
      let maxAnchorError = 0;
      let worstJoint = "none";
      for (let step = 0; step < 1800; step += 1) {
        world.setControls({ throttle: step < 450 ? 1 : step < 900 ? -1 : 0, steering: step % 600 < 300 ? 1 : -1 });
        world.step(1 / 60);
        if (step % 30 !== 0) continue;
        const frame = world.snapshot();
        for (const pose of Object.values(frame.transforms)) expect([...pose.position, ...pose.rotation].every(Number.isFinite)).toBe(true);
        for (const joint of specification.joints) {
          const poseA = frame.transforms[joint.bodyA]; const poseB = frame.transforms[joint.bodyB];
          if (poseA === undefined || poseB === undefined) continue;
          const anchorA = rotateVector(poseA.rotation, joint.anchorA).map((value, index) => value + (poseA.position[index] ?? 0)) as [number, number, number];
          const anchorB = rotateVector(poseB.rotation, joint.anchorB).map((value, index) => value + (poseB.position[index] ?? 0)) as [number, number, number];
          const error = tupleDistance(anchorA, anchorB);
          if (error > maxAnchorError) { maxAnchorError = error; worstJoint = `${joint.id}@${String(step)}`; }
        }
      }
      expect(maxAnchorError, `${sample.id}:${worstJoint}`).toBeLessThan(0.09);
      world.dispose();
    }
  });
});

describe("session fault isolation and clock", () => {
  function mocks(overrides: Partial<{ physics: PhysicsWorld; input: InputSource; renderer: SimulationRenderer }> = {}) {
    const physics = overrides.physics ?? { initialize: () => {}, setControls: () => {}, step: () => {}, snapshot: () => ({ step: 0, transforms: {} }), getStats: () => ({ bodies: 1, joints: 0, steps: 0 }), dispose: () => {} };
    const input = overrides.input ?? { read: () => ({ throttle: 0, steering: 0 }), dispose: () => {} };
    const renderer = overrides.renderer ?? { render: () => {}, dispose: () => {} };
    return { physics, input, renderer };
  }

  it("disposes physics even when input and renderer disposal throw", () => {
    const calls: string[] = [];
    const values = mocks({
      physics: { ...mocks().physics, dispose: () => { calls.push("physics"); } },
      input: { read: () => ({ throttle: 0, steering: 0 }), dispose: () => { calls.push("input"); throw new Error("input"); } },
      renderer: { render: () => {}, dispose: () => { calls.push("renderer"); throw new Error("renderer"); } },
    });
    const session = new SimulationSession(values.physics, values.input, values.renderer);
    expect(() => { session.dispose(); }).toThrow("simulation.session.dispose-failed");
    expect(calls).toEqual(["input", "renderer", "physics"]);
  });

  it("rolls start back to stopped when the initial render throws", () => {
    let disposed = 0;
    const values = mocks({ renderer: { render: () => { throw new Error("render"); }, dispose: () => {} }, physics: { ...mocks().physics, dispose: () => { disposed += 1; } } });
    const session = new SimulationSession(values.physics, values.input, values.renderer);
    expect(() => { session.start(); }).toThrow("render");
    expect(session.advance(1)).toBe(0);
    session.dispose();
    expect(disposed).toBe(1);
  });

  it("reports the complete dropped wall time for a one-second stall", () => {
    const telemetry: RuntimeTelemetryEvent[] = [];
    const values = mocks();
    const session = new SimulationSession(values.physics, values.input, values.renderer, { telemetry: (event) => telemetry.push(event) });
    session.start();
    session.advance(1);
    const event = telemetry.find((item) => item.type === "simulation.time.dropped");
    const payload = event?.payload as { droppedSeconds?: number } | undefined;
    expect(payload?.droppedSeconds).toBeCloseTo(11 / 12, 8);
  });

  it.each([30, 60, 120, 144])("advances the same 60 physics ticks at %i Hz", (fps) => {
    let steps = 0;
    const values = mocks({ physics: { ...mocks().physics, step: () => { steps += 1; }, getStats: () => ({ bodies: 1, joints: 0, steps }) } });
    const session = new SimulationSession(values.physics, values.input, values.renderer);
    session.start();
    for (let frame = 0; frame < fps; frame += 1) session.advance(1 / fps);
    expect(steps).toBe(60);
  });
});
