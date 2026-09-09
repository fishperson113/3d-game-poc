import { Machine } from "../../building/domain/machine";
import { createPlacementPreview, findPlacementCandidates, rootTransform, type AssemblyPlacementCandidate } from "../../building/application/assembly-solver";
import type { MachineBlueprint } from "../../building/domain/contracts";
import type { RuntimePartCatalog } from "../../parts/catalog";

export type RuntimeSampleId = "four-wheel-scout" | "six-wheel-hauler" | "eight-wheel-crawler";

export interface RuntimeSampleDefinition {
  readonly id: RuntimeSampleId;
  readonly label: string;
  readonly description: string;
  readonly wheels: number;
}

export const RUNTIME_SAMPLES: readonly RuntimeSampleDefinition[] = Object.freeze([
  { id: "four-wheel-scout", label: "Scout buggy", description: "4 wheels · front steering · compact", wheels: 4 },
  { id: "six-wheel-hauler", label: "Six-wheel hauler", description: "6 wheels · long chassis · stable", wheels: 6 },
  { id: "eight-wheel-crawler", label: "Eight-wheel crawler", description: "8 wheels · three frame blocks · long", wheels: 8 },
]);

function choose(blueprint: MachineBlueprint, definitionId: string, targetPartId: string, targetSocketId: string, catalog: RuntimePartCatalog, sourceSocketId?: string): AssemblyPlacementCandidate {
  const candidate = findPlacementCandidates(blueprint, definitionId, catalog).find((item) => item.targetPartId === targetPartId && item.targetSocketId === targetSocketId && (sourceSocketId === undefined || item.sourceSocketId === sourceSocketId));
  if (candidate === undefined) throw new Error(`runtime.fixture.no-placement:${definitionId}:${targetPartId}:${targetSocketId}:${sourceSocketId ?? "any"}`);
  return candidate;
}

function add(machine: Machine, definitionId: string, partId: string, targetPartId: string, targetSocketId: string, catalog: RuntimePartCatalog, sourceSocketId?: string): void {
  const candidate = choose(machine.blueprint, definitionId, targetPartId, targetSocketId, catalog, sourceSocketId);
  const preview = createPlacementPreview(machine.blueprint, definitionId, partId, candidate, catalog);
  const placed = machine.placeAndConnect(preview.placement);
  if (!placed.ok) throw new Error(`${placed.error.code}:${partId}`);
}

function createMachine(catalog: RuntimePartCatalog, machineId: string): Machine {
  const created = Machine.create(machineId, { resolvePart: (definitionId) => catalog.get(definitionId) });
  if (!created.ok) throw new Error(created.error.code);
  const machine = created.value;
  const root = machine.addPart({ id: "chassis", definitionId: "core.structural-block", transform: rootTransform() });
  if (!root.ok) throw new Error(root.error.code);
  return machine;
}

function addFrontSteering(machine: Machine, catalog: RuntimePartCatalog): void {
  add(machine, "core.steering-hinge", "hinge-front-left", "chassis", "mount-front-left", catalog, "mount");
  add(machine, "core.steering-hinge", "hinge-front-right", "chassis", "mount-front-right", catalog, "mount");
  add(machine, "core.powered-wheel", "wheel-front-left", "hinge-front-left", "axle", catalog, "axle");
  add(machine, "core.powered-wheel", "wheel-front-right", "hinge-front-right", "axle", catalog, "axle");
}

function addWheelPair(machine: Machine, blockId: string, wheelPrefix: string, catalog: RuntimePartCatalog, mountPrefix: "front" | "rear"): void {
  add(machine, "core.powered-wheel", `${wheelPrefix}-left`, blockId, `mount-${mountPrefix}-left`, catalog, "axle");
  add(machine, "core.powered-wheel", `${wheelPrefix}-right`, blockId, `mount-${mountPrefix}-right`, catalog, "axle");
}

/** Runtime sample built from the same authoritative socket solver used by palette assembly. */
export function createRuntimeSampleFixture(catalog: RuntimePartCatalog, sampleId: RuntimeSampleId = "four-wheel-scout", machineId = `runtime-${sampleId}`): MachineBlueprint {
  const machine = createMachine(catalog, machineId);
  addFrontSteering(machine, catalog);
  addWheelPair(machine, "chassis", "wheel-rear", catalog, "rear");

  if (sampleId === "six-wheel-hauler" || sampleId === "eight-wheel-crawler") {
    // The snap solver mates source sockets face-to-face. Use the rear socket
    // on the new frame so its center moves behind chassis rather than
    // overlapping the existing frame at the same world position.
    add(machine, "core.structural-block", "frame-middle", "chassis", "frame-rear", catalog, "frame-rear");
    addWheelPair(machine, "frame-middle", "wheel-middle", catalog, "front");
  }
  if (sampleId === "eight-wheel-crawler") {
    add(machine, "core.structural-block", "frame-tail", "frame-middle", "frame-front", catalog, "frame-front");
    addWheelPair(machine, "frame-tail", "wheel-tail", catalog, "rear");
  }
  return machine.blueprint;
}

export function sampleDefinition(sampleId: RuntimeSampleId): RuntimeSampleDefinition {
  const definition = RUNTIME_SAMPLES.find((sample) => sample.id === sampleId);
  if (definition === undefined) throw new Error(`runtime.sample.unknown:${sampleId}`);
  return definition;
}
