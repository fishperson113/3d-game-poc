import type { Result } from "../../kernel/result";
import type { PartCatalog } from "../ports/part-catalog";
import type { ConnectionInput, MachineBlueprint, MachineCommandError } from "../domain/contracts";
import { Machine } from "../domain/machine";

const pose = (x: number, y: number, z: number) => ({ position: [x, y, z] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] });

function connect(machine: Machine, connection: ConnectionInput): Result<unknown, MachineCommandError> {
  return machine.connectParts(connection);
}

/** Stable domain-only fixture consumed by headless simulation tests. */
export function createFourWheelMachineFixture(catalog: PartCatalog, machineId = "fixture-four-wheel"): Result<MachineBlueprint, MachineCommandError> {
  const created = Machine.create(machineId, { resolvePart: (definitionId) => catalog.get(definitionId) });
  if (!created.ok) return created;
  const machine = created.value;
  const parts = [
    { id: "chassis", definitionId: "core.structural-block", transform: pose(0, 1, 0) },
    { id: "hinge-front-left", definitionId: "core.steering-hinge", transform: pose(-0.75, 0.65, 0.8) },
    { id: "hinge-front-right", definitionId: "core.steering-hinge", transform: pose(0.75, 0.65, 0.8) },
    { id: "wheel-front-left", definitionId: "core.powered-wheel", transform: pose(-0.75, 0.35, 0.8) },
    { id: "wheel-front-right", definitionId: "core.powered-wheel", transform: pose(0.75, 0.35, 0.8) },
    { id: "wheel-rear-left", definitionId: "core.powered-wheel", transform: pose(-0.75, 0.35, -0.8) },
    { id: "wheel-rear-right", definitionId: "core.powered-wheel", transform: pose(0.75, 0.35, -0.8) },
  ] as const;
  for (const part of parts) {
    const result = machine.addPart(part);
    if (!result.ok) return result;
  }
  const connections: ConnectionInput[] = [
    { id: "mount-front-left", a: { partId: "chassis", socketId: "mount-front-left" }, b: { partId: "hinge-front-left", socketId: "mount" }, joint: { type: "revolute", axis: [0, 1, 0], limits: [-0.6, 0.6] } },
    { id: "mount-front-right", a: { partId: "chassis", socketId: "mount-front-right" }, b: { partId: "hinge-front-right", socketId: "mount" }, joint: { type: "revolute", axis: [0, 1, 0], limits: [-0.6, 0.6] } },
    { id: "steer-front-left", a: { partId: "hinge-front-left", socketId: "axle" }, b: { partId: "wheel-front-left", socketId: "axle" }, joint: { type: "revolute", axis: [1, 0, 0] } },
    { id: "steer-front-right", a: { partId: "hinge-front-right", socketId: "axle" }, b: { partId: "wheel-front-right", socketId: "axle" }, joint: { type: "revolute", axis: [1, 0, 0] } },
    { id: "mount-rear-left", a: { partId: "chassis", socketId: "mount-rear-left" }, b: { partId: "wheel-rear-left", socketId: "axle" }, joint: { type: "revolute", axis: [1, 0, 0] } },
    { id: "mount-rear-right", a: { partId: "chassis", socketId: "mount-rear-right" }, b: { partId: "wheel-rear-right", socketId: "axle" }, joint: { type: "revolute", axis: [1, 0, 0] } },
  ];
  for (const connection of connections) {
    const result = connect(machine, connection);
    if (!result.ok) return result;
  }
  const bindings = [
    ["drive-front-left", "wheel-front-left"], ["drive-front-right", "wheel-front-right"], ["drive-rear-left", "wheel-rear-left"], ["drive-rear-right", "wheel-rear-right"],
  ] as const;
  for (const [id, partId] of bindings) {
    const result = machine.bindControl({ id, action: "drive", partId, capability: "core.motor-wheel" });
    if (!result.ok) return result;
  }
  for (const [id, partId] of [["steer-left", "hinge-front-left"], ["steer-right", "hinge-front-right"]] as const) {
    const result = machine.bindControl({ id, action: "steer", partId, capability: "core.steering" });
    if (!result.ok) return result;
  }
  return { ok: true, value: machine.blueprint };
}
