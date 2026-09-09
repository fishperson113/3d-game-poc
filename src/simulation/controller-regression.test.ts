import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { initializeRapier, RapierPhysicsWorld } from "../adapters/rapier/rapier-physics-world";
import { StaticPartCatalog } from "../parts/catalog";
import { NamespacedEventBus } from "../kernel/events";
import { eulerFromQuaternion, quaternionConjugate, quaternionFromEuler, quaternionMultiply, rotateVector } from "../kernel/math";
import { SimulationCompiler, defaultSimulationEnvironment } from "./application/simulation-compiler";
import { createRuntimeSampleFixture, RUNTIME_SAMPLES } from "./fixtures/runtime-samples";
import type { MachineBlueprint } from "../building/domain/contracts";
import { interpolateFrame, SimulationSession } from "./application/simulation-session";

const catalog = new StaticPartCatalog();
const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });
function compile(blueprint = createRuntimeSampleFixture(catalog)) {
  const baseline = defaultSimulationEnvironment();
  const result = compiler.compile(blueprint, { ...baseline, ground: { ...baseline.ground, halfExtents: [100, 0.15, 100] }, ramp: { ...baseline.ramp, position: [100, 0, 100] } });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
function drive(blueprint: MachineBlueprint, throttle: number, steering: number) {
  const { world } = compile(blueprint);
  try {
    for (let i = 0; i < 90; i++) world.step(1 / 60);
    const rootId = String(blueprint.parts[0]?.id);
    const before = world.snapshot().transforms[rootId];
    if (before === undefined) throw new Error("missing root");
    world.setControls({ throttle, steering });
    for (let i = 0; i < 180; i++) world.step(1 / 60);
    const after = world.snapshot().transforms[rootId];
    if (after === undefined) throw new Error("missing root");
    const inverse = quaternionConjugate(before.rotation);
    const delta = rotateVector(inverse, [after.position[0] - before.position[0], after.position[1] - before.position[1], after.position[2] - before.position[2]]);
    const forward = rotateVector(quaternionMultiply(inverse, after.rotation), [0, 0, 1]);
    return { delta, yaw: Math.atan2(forward[0], forward[2]), up: rotateVector(after.rotation, [0, 1, 0])[1] };
  } finally { world.dispose(); }
}

describe("controller and physics regressions", () => {
  beforeAll(initializeRapier);
  it.each(RUNTIME_SAMPLES)("$id drives straight and obeys both steering directions", (sample) => {
    const blueprint = createRuntimeSampleFixture(catalog, sample.id);
    const straight = drive(blueprint, 1, 0);
    expect(straight.delta[2]).toBeGreaterThan(5);
    expect(Math.abs(straight.delta[0])).toBeLessThan(0.15);
    expect(Math.abs(straight.yaw)).toBeLessThan(0.03);
    const left = drive(blueprint, 1, -1);
    const right = drive(blueprint, 1, 1);
    expect(left.delta[0]).toBeLessThan(-1);
    expect(right.delta[0]).toBeGreaterThan(1);
    expect(left.yaw).toBeLessThan(-0.2);
    expect(right.yaw).toBeGreaterThan(0.2);
    expect(left.up).toBeGreaterThan(0.95);
    expect(right.up).toBeGreaterThan(0.95);
    expect(drive(blueprint, -1, 0).delta[2]).toBeLessThan(-5);
  });
  it("keeps behavior when connections are reversed, IDs renamed, or the assembly rotates", () => {
    const source = createRuntimeSampleFixture(catalog);
    const reversed = { ...source, connections: source.connections.map((joint) => ({ ...joint, a: joint.b, b: joint.a })) };
    expect(drive(reversed, 1, 0)).toEqual(drive(source, 1, 0));
    const quarter = quaternionFromEuler([0, Math.PI / 2, 0]);
    const rotated = { ...source, parts: source.parts.map((part) => ({ ...part, transform: { position: rotateVector(quarter, part.transform.position), rotation: eulerFromQuaternion(quaternionMultiply(quarter, quaternionFromEuler(part.transform.rotation))) } })) };
    const moved = drive(rotated, 1, 0);
    expect(moved.delta[2]).toBeGreaterThan(5);
    expect(Math.abs(moved.delta[0])).toBeLessThan(0.2);
    const rename = (id: string) => `component-${String(source.parts.findIndex((part) => part.id === id))}`;
    const renamed = JSON.parse(JSON.stringify(source).replace(/"(?:chassis|hinge-front-left|hinge-front-right|wheel-front-left|wheel-front-right|wheel-rear-left|wheel-rear-right)"/g, (id) => JSON.stringify(rename(JSON.parse(id) as string)))) as MachineBlueprint;
    expect(drive(renamed, 1, 0).delta[2]).toBeGreaterThan(5);
  });
  it("honors configured steering limits and exact manifest masses", () => {
    const original = createRuntimeSampleFixture(catalog);
    const blueprint = { ...original, parts: original.parts.map((part) => part.definitionId === "core.steering-hinge" ? { ...part, configuration: { steeringLimitRadians: 0.1 } } : part) };
    const { world, specification } = compile(blueprint);
    try {
      world.step(1 / 60);
      for (const body of specification.bodies) expect(world.getStats().bodyMasses?.[body.id]).toBeCloseTo(body.physics.body.mass, 5);
      for (const actuator of specification.actuators.filter((item) => item.action === "steer")) {
        expect(actuator.limitRadians).toBe(0.1);
        expect(specification.joints.find((joint) => joint.id === actuator.jointId)?.limits).toEqual([-0.1, 0.1]);
      }
      for (let i = 0; i < 90; i++) world.step(1 / 60);
      world.setControls({ throttle: 0.5, steering: 1 });
      for (let i = 0; i < 180; i++) world.step(1 / 60);
      const frames = world.snapshot().transforms;
      const chassis = frames.chassis;
      const hinge = frames["hinge-front-left"];
      if (chassis === undefined || hinge === undefined) throw new Error("missing transforms");
      const relative = quaternionMultiply(quaternionConjugate(chassis.rotation), hinge.rotation);
      const forward = rotateVector(relative, [0, 0, -1]);
      expect(Math.atan2(forward[0], forward[2])).toBeCloseTo(0.1, 1);
    } finally { world.dispose(); }
  });
  it("uses the same quaternion for combined-axis visual and physical poses", () => {
    const angles = [Math.PI / 2, Math.PI / 2, 0] as const;
    const root = new THREE.Group();
    root.quaternion.set(...quaternionFromEuler(angles));
    expect(root.quaternion.toArray()).toEqual([...quaternionFromEuler(angles)]);
    const vector = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    expect(vector.toArray()).toEqual([...rotateVector(quaternionFromEuler(angles), [0, 0, 1])]);
  });
  it("interpolates antipodal quaternions without jumps and bounds frame backlog", () => {
    const frame = { step: 1, transforms: { root: { position: [2, 0, 0] as const, rotation: [0, 0, 0, -1] as const } } };
    const previous = { step: 0, transforms: { root: { position: [0, 0, 0] as const, rotation: [0, 0, 0, 1] as const } } };
    expect(interpolateFrame(previous, frame, 0.5).transforms.root).toEqual({ position: [1, 0, 0], rotation: [0, 0, 0, 1] });
    const { world } = compile();
    const session = new SimulationSession(world, { read: () => ({ throttle: 0, steering: 0 }), dispose: () => undefined }, { render: () => undefined, dispose: () => undefined });
    try {
      session.start();
      expect(session.advance(0.25)).toBe(5);
      expect(session.getStats().accumulatorSeconds).toBeLessThan(1 / 60);
      expect(session.advance(NaN)).toBe(0);
    } finally { session.dispose(); }
  });
});
