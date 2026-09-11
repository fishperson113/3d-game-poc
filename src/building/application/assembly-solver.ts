import type { ConnectionInput, MachineBlueprint, PartTransform } from "../domain/contracts";
import type { PartDefinition, SocketDefinition } from "../domain/part-definition";
import { snapPartTransform, worldSocketFrame } from "../../kernel/math";
import type { AddPartInput, PlaceAndConnectInput } from "../domain/machine";
import type { PartCatalog } from "../ports/part-catalog";

export interface AssemblyPlacementCandidate {
  readonly targetPartId: string;
  readonly targetSocketId: string;
  readonly sourceSocketId: string;
  readonly transform: PartTransform;
}

export interface AssemblyPlacementPreview extends AssemblyPlacementCandidate {
  readonly placement: PlaceAndConnectInput;
}

function compatible(left: SocketDefinition, right: SocketDefinition): boolean {
  const leftTags = new Set([left.id, ...(left.tags ?? [])]);
  const rightTags = new Set([right.id, ...(right.tags ?? [])]);
  return left.accepts.some((tag) => rightTags.has(tag)) && right.accepts.some((tag) => leftTags.has(tag));
}

function occupied(blueprint: MachineBlueprint, partId: string, socketId: string, socket: SocketDefinition): boolean {
  return socket.singleUse !== false && blueprint.connections.some((connection) => (connection.a.partId === partId && connection.a.socketId === socketId) || (connection.b.partId === partId && connection.b.socketId === socketId));
}

function definitionFor(catalog: PartCatalog, partId: string, blueprint: MachineBlueprint): PartDefinition | undefined {
  const part = blueprint.parts.find((candidate) => candidate.id === partId);
  return part === undefined ? undefined : catalog.get(part.definitionId);
}

function socket(definition: PartDefinition, socketId: string): SocketDefinition | undefined {
  return definition.sockets.find((candidate) => candidate.id === socketId);
}

function defaultJoint(definitionId: string, targetSocketId: string): ConnectionInput["joint"] {
  if (definitionId === "core.steering-hinge") return { type: "revolute", axis: [0, 1, 0], limits: [-0.6, 0.6] };
  if (definitionId === "core.motor-module") return { type: "fixed" };
  if (definitionId === "core.powered-wheel" || definitionId === "core.crawler-track" || definitionId === "core.drive-gear") return { type: "revolute", axis: [1, 0, 0] };
  void targetSocketId;
  return { type: "fixed" };
}

function defaultBindings(part: AddPartInput, catalog: PartCatalog): readonly NonNullable<PlaceAndConnectInput["bindings"]>[number][] {
  const definition = catalog.get(part.definitionId);
  if (definition === undefined) return [];
  const bindings: NonNullable<PlaceAndConnectInput["bindings"]>[number][] = [];
  if (definition.capabilities.includes("core.motor-wheel")) bindings.push({ id: `${part.id}-drive`, action: "drive", partId: part.id, capability: "core.motor-wheel" });
  if (definition.capabilities.includes("core.steering")) bindings.push({ id: `${part.id}-steer`, action: "steer", partId: part.id, capability: "core.steering" });
  return bindings;
}

export function findPlacementCandidates(blueprint: MachineBlueprint, definitionId: string, catalog: PartCatalog): readonly AssemblyPlacementCandidate[] {
  const definition = catalog.get(definitionId);
  if (definition === undefined) return [];
  const candidates: AssemblyPlacementCandidate[] = [];
  for (const targetPart of blueprint.parts) {
    const targetDefinition = catalog.get(targetPart.definitionId);
    if (targetDefinition === undefined) continue;
    for (const targetSocket of targetDefinition.sockets) {
      if (occupied(blueprint, targetPart.id, targetSocket.id, targetSocket)) continue;
      const targetFrame = worldSocketFrame(targetPart.transform, targetSocket);
      for (const sourceSocket of definition.sockets) {
        if (!compatible(targetSocket, sourceSocket)) continue;
        candidates.push({ targetPartId: targetPart.id, targetSocketId: targetSocket.id, sourceSocketId: sourceSocket.id, transform: snapPartTransform(targetFrame, sourceSocket) });
      }
    }
  }
  // Prefer front bumper for climbing gears, steering axles for powered wheels, and tracks.
  if (definitionId === "core.powered-wheel" || definitionId === "core.crawler-track" || definitionId === "core.drive-gear") {
    const priority = (candidate: AssemblyPlacementCandidate): number => {
      if (definitionId === "core.drive-gear" && candidate.targetSocketId === "frame-front") return -1;
      if (candidate.targetSocketId === "axle") return 0;
      if (candidate.targetSocketId.startsWith("mount-")) return 1;
      return 2;
    };
    candidates.sort((left, right) => priority(left) - priority(right));
  }
  return candidates;
}

export function createPlacementPreview(_blueprint: MachineBlueprint, definitionId: string, partId: string, candidate: AssemblyPlacementCandidate, catalog: PartCatalog): AssemblyPlacementPreview {
  const part: AddPartInput = { id: partId, definitionId, transform: candidate.transform };
  const placement: PlaceAndConnectInput = {
    part,
    connection: { id: `${partId}::${candidate.targetPartId}::${candidate.targetSocketId}`, a: { partId: candidate.targetPartId, socketId: candidate.targetSocketId }, b: { partId, socketId: candidate.sourceSocketId }, joint: defaultJoint(definitionId, candidate.targetSocketId) },
    bindings: defaultBindings(part, catalog),
  };
  return { ...candidate, placement };
}

export function rotatePlacementCandidate(blueprint: MachineBlueprint, definitionId: string, candidate: AssemblyPlacementCandidate, catalog: PartCatalog, quarterTurns: number): AssemblyPlacementCandidate {
  const targetPart = blueprint.parts.find((part) => part.id === candidate.targetPartId);
  const targetDefinition = targetPart === undefined ? undefined : catalog.get(targetPart.definitionId);
  const sourceDefinition = catalog.get(definitionId);
  const targetSocket = targetDefinition?.sockets.find((socket) => socket.id === candidate.targetSocketId);
  const sourceSocket = sourceDefinition?.sockets.find((socket) => socket.id === candidate.sourceSocketId);
  if (targetPart === undefined || targetSocket === undefined || sourceSocket === undefined) return candidate;
  return { ...candidate, transform: snapPartTransform(worldSocketFrame(targetPart.transform, targetSocket), sourceSocket, quarterTurns) };
}

export function rootTransform(): PartTransform {
  // Wheel radius (0.48 m) plus the socket offset (-0.25 m) puts the wheel
  // contact patch at ground level when the chassis origin starts at 0.75 m.
  return { position: [0, 0.75, 0], rotation: [0, 0, 0] };
}

export function getSocketFrame(blueprint: MachineBlueprint, catalog: PartCatalog, partId: string, socketId: string): ReturnType<typeof worldSocketFrame> | undefined {
  const part = blueprint.parts.find((candidate) => candidate.id === partId);
  const definition = definitionFor(catalog, partId, blueprint);
  const socketDefinition = definition === undefined ? undefined : socket(definition, socketId);
  return part === undefined || socketDefinition === undefined ? undefined : worldSocketFrame(part.transform, socketDefinition);
}
