import { beforeAll, describe, expect, it } from "vitest";
import { initializeRapier, RapierPhysicsWorld } from "../adapters/rapier/rapier-physics-world";
import { StaticPartCatalog } from "../parts/catalog";
import { NamespacedEventBus } from "../kernel/events";
import { SimulationCompiler } from "./application/simulation-compiler";
import { createRuntimeSampleFixture } from "./fixtures/runtime-samples";
import { STEM_CHALLENGES } from "../challenge/domain/challenges-data";
import { RealtimeChallengeEvaluator } from "../challenge/domain/challenge-evaluator";
import type { ChallengeDefinition } from "../challenge/domain/contracts";
import type { MachineBlueprint } from "../building/domain/contracts";
import { asPartId, asConnectionId, asControlBindingId } from "../building/domain/contracts";
import { createPlacementPreview, findPlacementCandidates } from "../building/application/assembly-solver";

const catalog = new StaticPartCatalog();
const compiler = new SimulationCompiler({ catalog, events: new NamespacedEventBus(), createPhysicsWorld: () => new RapierPhysicsWorld() });

function attachPart(blueprint: MachineBlueprint, definitionId: string, partIdStr: string, targetPartIdStr: string, targetSocketId: string): MachineBlueprint {
  const candidate = findPlacementCandidates(blueprint, definitionId, catalog).find((c) => c.targetPartId === targetPartIdStr && c.targetSocketId === targetSocketId);
  if (candidate === undefined) {
    throw new Error(`placement.candidate.not-found:${definitionId}:${targetPartIdStr}:${targetSocketId}`);
  }
  const preview = createPlacementPreview(blueprint, definitionId, partIdStr, candidate, catalog);
  return {
    ...blueprint,
    parts: blueprint.parts.concat({
      id: asPartId(preview.placement.part.id),
      definitionId: preview.placement.part.definitionId,
      transform: preview.placement.part.transform,
      ...(preview.placement.part.configuration ? { configuration: preview.placement.part.configuration } : {}),
    }),
    connections: blueprint.connections.concat({
      id: asConnectionId(preview.placement.connection.id),
      a: { partId: asPartId(preview.placement.connection.a.partId), socketId: preview.placement.connection.a.socketId },
      b: { partId: asPartId(preview.placement.connection.b.partId), socketId: preview.placement.connection.b.socketId },
      joint: preview.placement.connection.joint,
    }),
    controlBindings: blueprint.controlBindings.concat((preview.placement.bindings ?? []).map((b) => ({
      id: asControlBindingId(b.id),
      action: b.action,
      partId: asPartId(b.partId),
      capability: b.capability,
      ...(b.parameters ? { parameters: b.parameters } : {}),
    }))),
  };
}

function runLevelTest(challenge: ChallengeDefinition, blueprint: MachineBlueprint, durationSeconds = 12) {
  const compiled = compiler.compile(blueprint, challenge.environment);
  if (!compiled.ok) {
    return { ok: false as const, error: compiled.error, completed: false, failed: false, finalPos: undefined };
  }
  const { world } = compiled.value;
  const rootId = String(blueprint.parts[0]?.id);
  const evaluator = new RealtimeChallengeEvaluator(challenge);
  evaluator.start();

  // Settle vehicle on spawn pad
  for (let i = 0; i < 30; i++) world.step(1 / 60);

  world.setControls({ throttle: 1, steering: 0 });
  const totalSteps = Math.round(durationSeconds * 60);
  let completed = false;
  let failed = false;
  let completeTime = 0;

  for (let step = 0; step < totalSteps; step++) {
    world.step(1 / 60);
    const snap = world.snapshot().transforms[rootId];
    if (snap !== undefined) {
      const evalSnap = evaluator.step(1 / 60, snap.position);
      if (evalSnap.status === "completed" && !completed) {
        completed = true;
        completeTime = evalSnap.elapsedSeconds;
      }
      if (evalSnap.status === "failed") {
        failed = true;
        break;
      }
    }
  }

  const finalSnap = world.snapshot().transforms[rootId];
  world.dispose();
  return {
    ok: true as const,
    completed,
    failed,
    completeTime,
    finalPos: finalSnap?.position,
  };
}

describe("Levels 4, 5, 6 Physics & Gameplay Simulation", () => {
  beforeAll(initializeRapier);

  describe("Level 4: V-Trench (Rãnh Chữ V)", () => {
    const ch4 = STEM_CHALLENGES.find((c) => c.id === "v-trench");
    if (ch4 === undefined) throw new Error("Challenge v-trench not found");

    it("evaluates four-wheel-scout in Level 4 (gets stuck due to lack of climb torque)", () => {
      const bp = createRuntimeSampleFixture(catalog, "four-wheel-scout");
      const res = runLevelTest(ch4, bp, 10);
      // Naive scout does not complete because it gets stuck on the upward slope
      expect(res.completed).toBe(false);
      expect(res.failed).toBe(false); // Does not fall through void
    });

    it("evaluates four-wheel-scout with drive-gear in Level 4 (climbs out and wins)", () => {
      const bp = createRuntimeSampleFixture(catalog, "four-wheel-scout");
      const withGear = attachPart(bp, "core.drive-gear", "gear-front", "chassis", "frame-front");

      const res = runLevelTest(ch4, withGear, 12);
      expect(res.completed).toBe(true);
      expect(res.failed).toBe(false);
    });

    it("evaluates eight-wheel-crawler in Level 4 (stalls on slope due to high weight / stock motors)", () => {
      const bp = createRuntimeSampleFixture(catalog, "eight-wheel-crawler");
      const res = runLevelTest(ch4, bp, 15);
      expect(res.completed).toBe(false);
      expect(res.failed).toBe(false);
    });

    it("evaluates six-wheel-hauler with drive-gear in Level 4 (climbs through trench and wins)", () => {
      const bp = createRuntimeSampleFixture(catalog, "six-wheel-hauler");
      const withGear = attachPart(bp, "core.drive-gear", "gear-front", "chassis", "frame-front");

      const res = runLevelTest(ch4, withGear, 12);
      expect(res.completed).toBe(true);
      expect(res.failed).toBe(false);
    });
  });

  describe("Level 5: High-Peak (Gờ Nhô Kẹt Bụng)", () => {
    const ch5 = STEM_CHALLENGES.find((c) => c.id === "high-peak");
    if (ch5 === undefined) throw new Error("Challenge high-peak not found");

    it("shows eight-wheel-crawler gets high-centered on the peak as designed", () => {
      const bp = createRuntimeSampleFixture(catalog, "eight-wheel-crawler");
      const res = runLevelTest(ch5, bp, 12);
      expect(res.completed).toBe(false);
      expect(res.failed).toBe(false);
      // Belly stuck on the peak tip (y around 1.06m, z around 2.27m)
      expect(res.finalPos?.[1]).toBeGreaterThan(0.7);
      expect(res.finalPos?.[2]).toBeLessThan(6.0);
    });

    it("shows four-wheel-scout clears the peak due to short wheelbase", () => {
      const bp = createRuntimeSampleFixture(catalog, "four-wheel-scout");
      const res = runLevelTest(ch5, bp, 12);
      expect(res.completed).toBe(true);
      expect(res.failed).toBe(false);
    });
  });

  describe("Level 6: Bumpy-Road (Bãi Đá Gập Ghềnh)", () => {
    const ch6 = STEM_CHALLENGES.find((c) => c.id === "bumpy-road");
    if (ch6 === undefined) throw new Error("Challenge bumpy-road not found");

    it("evaluates four-wheel-scout across staggered bumps", () => {
      const bp = createRuntimeSampleFixture(catalog, "four-wheel-scout");
      const res = runLevelTest(ch6, bp, 12);
      // Vehicle remains upright without falling into the void
      expect(res.failed).toBe(false);
    });

    it("evaluates vehicle with heavy battery box for low center-of-gravity stabilization", () => {
      const bp = createRuntimeSampleFixture(catalog, "four-wheel-scout");
      const withBattery = attachPart(bp, "core.battery-box", "battery-top", "chassis", "frame-top");

      const res = runLevelTest(ch6, withBattery, 12);
      expect(res.completed).toBe(true);
      expect(res.failed).toBe(false);
    });
  });
});
