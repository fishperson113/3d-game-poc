import { Machine } from "../../building/domain/machine";
import { createPlacementPreview, findPlacementCandidates, rootTransform, type AssemblyPlacementCandidate } from "../../building/application/assembly-solver";
import type { MachineBlueprint } from "../../building/domain/contracts";
import type { RuntimePartCatalog } from "../../parts/catalog";

function choose(blueprint: MachineBlueprint, definitionId: string, targetPartId: string, targetSocketId: string, catalog: RuntimePartCatalog): AssemblyPlacementCandidate {
  const candidate = findPlacementCandidates(blueprint, definitionId, catalog).find((item) => item.targetPartId === targetPartId && item.targetSocketId === targetSocketId);
  if (candidate === undefined) throw new Error(`runtime.fixture.no-placement:${definitionId}:${targetPartId}:${targetSocketId}`);
  return candidate;
}

function add(machine: Machine, definitionId: string, partId: string, targetPartId: string, targetSocketId: string, catalog: RuntimePartCatalog): void {
  const candidate = choose(machine.blueprint, definitionId, targetPartId, targetSocketId, catalog);
  const preview = createPlacementPreview(machine.blueprint, definitionId, partId, candidate, catalog);
  const placed = machine.placeAndConnect(preview.placement);
  if (!placed.ok) throw new Error(`${placed.error.code}:${partId}`);
}

/** Runtime fixture built through the authoritative manifest sockets and snap solver. */
export function createRuntimeFourWheelFixture(catalog: RuntimePartCatalog, machineId = "runtime-four-wheel"): MachineBlueprint {
  const created = Machine.create(machineId, { resolvePart: (definitionId) => catalog.get(definitionId) });
  if (!created.ok) throw new Error(created.error.code);
  const machine = created.value;
  const root = machine.addPart({ id: "chassis", definitionId: "core.structural-block", transform: rootTransform() });
  if (!root.ok) throw new Error(root.error.code);
  add(machine, "core.steering-hinge", "hinge-front-left", "chassis", "mount-front-left", catalog);
  add(machine, "core.steering-hinge", "hinge-front-right", "chassis", "mount-front-right", catalog);
  add(machine, "core.powered-wheel", "wheel-front-left", "hinge-front-left", "axle", catalog);
  add(machine, "core.powered-wheel", "wheel-front-right", "hinge-front-right", "axle", catalog);
  add(machine, "core.powered-wheel", "wheel-rear-left", "chassis", "mount-rear-left", catalog);
  add(machine, "core.powered-wheel", "wheel-rear-right", "chassis", "mount-rear-right", catalog);
  return machine.blueprint;
}
