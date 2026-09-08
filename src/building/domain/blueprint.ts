import type { JsonValue } from "../../kernel/json";
import type { Result } from "../../kernel/result";
import { asConnectionId, asControlBindingId, asMachineId, asPartId, type MachineBlueprint, type PartTransform } from "./contracts";
import { normalizePartConfiguration, type PartDefinition, type SocketDefinition } from "./part-definition";
import { cloneBlueprint } from "./machine";

export interface BlueprintValidationError {
  readonly code: string;
  readonly path?: string;
}

export interface BlueprintCatalog {
  readonly resolvePart: (definitionId: string) => PartDefinition | undefined;
}

function object(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finiteTuple(value: unknown, length: number): value is PartTransform["position"] {
  return Array.isArray(value) && value.length === length && Array.from(value).every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function jsonValue(value: unknown, seen = new WeakSet<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  const prototype = Reflect.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value) ? value.every((entry) => jsonValue(entry, seen)) : Object.values(value).every((entry) => jsonValue(entry, seen));
  seen.delete(value);
  return valid;
}

function fail(code: string, path?: string): Result<MachineBlueprint, BlueprintValidationError> {
  return path === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, path } };
}

export function parseMachineBlueprint(input: unknown, catalog?: BlueprintCatalog): Result<MachineBlueprint, BlueprintValidationError> {
  if (!object(input)) return fail("building.blueprint.invalid-document");
  if (input.schemaVersion !== 1) return fail("building.blueprint.unsupported-schema", "schemaVersion");
  if (typeof input.id !== "string" || input.id.trim().length === 0) return fail("building.blueprint.invalid-id", "id");
  if (typeof input.version !== "number" || !Number.isInteger(input.version) || input.version < 0) return fail("building.blueprint.invalid-version", "version");
  if (!Array.isArray(input.parts) || !Array.isArray(input.connections) || !Array.isArray(input.controlBindings)) return fail("building.blueprint.invalid-collections");

  const rawParts = input.parts as unknown[];
  const rawConnections = input.connections as unknown[];
  const rawBindings = input.controlBindings as unknown[];
  const partIds = new Set<string>();
  const parts: Array<MachineBlueprint["parts"][number]> = [];
  for (let index = 0; index < rawParts.length; index += 1) {
    const value = rawParts[index];
    if (!object(value) || typeof value.id !== "string" || value.id.trim().length === 0 || typeof value.definitionId !== "string" || value.definitionId.trim().length === 0 || !object(value.transform)) return fail("building.blueprint.invalid-part", `parts[${String(index)}]`);
    if (partIds.has(value.id)) return fail("building.part.duplicate-id", `parts[${String(index)}].id`);
    if (!finiteTuple(value.transform.position, 3) || !finiteTuple(value.transform.rotation, 3)) return fail("building.transform.invalid", `parts[${String(index)}].transform`);
    if (value.configuration !== undefined && (!object(value.configuration) || !jsonValue(value.configuration))) return fail("building.part.configuration-invalid", `parts[${String(index)}].configuration`);
    partIds.add(value.id);
    parts.push({ id: asPartId(value.id), definitionId: value.definitionId, transform: { position: [...value.transform.position], rotation: [...value.transform.rotation] }, ...(value.configuration === undefined ? {} : { configuration: value.configuration }) });
  }

  const connections: Array<MachineBlueprint["connections"][number]> = [];
  const connectionIds = new Set<string>();
  for (let index = 0; index < rawConnections.length; index += 1) {
    const value = rawConnections[index];
    if (!object(value) || typeof value.id !== "string" || value.id.trim().length === 0 || !object(value.a) || !object(value.b) || !object(value.joint)) return fail("building.blueprint.invalid-connection", `connections[${String(index)}]`);
    if (connectionIds.has(value.id)) return fail("building.connection.duplicate-id", `connections[${String(index)}].id`);
    if (typeof value.a.partId !== "string" || value.a.partId.trim().length === 0 || typeof value.a.socketId !== "string" || value.a.socketId.trim().length === 0 || typeof value.b.partId !== "string" || value.b.partId.trim().length === 0 || typeof value.b.socketId !== "string" || value.b.socketId.trim().length === 0) return fail("building.blueprint.invalid-socket-ref", `connections[${String(index)}]`);
    if (!partIds.has(value.a.partId) || !partIds.has(value.b.partId)) return fail("building.blueprint.dangling-connection", `connections[${String(index)}]`);
    if (value.a.partId === value.b.partId && value.a.socketId === value.b.socketId) return fail("building.connection.same-socket", `connections[${String(index)}]`);
    if (value.joint.type !== "fixed" && value.joint.type !== "revolute") return fail("building.blueprint.invalid-joint", `connections[${String(index)}].joint.type`);
    if (value.joint.axis !== undefined && (!finiteTuple(value.joint.axis, 3) || (value.joint.type === "revolute" && value.joint.axis.every((component) => component === 0)))) return fail("building.joint.invalid-axis", `connections[${String(index)}].joint.axis`);
    if (value.joint.limits !== undefined && (!finiteTuple(value.joint.limits, 2) || value.joint.limits[0] > value.joint.limits[1])) return fail("building.joint.invalid-limits", `connections[${String(index)}].joint.limits`);
    connectionIds.add(value.id);
    connections.push({ id: asConnectionId(value.id), a: { partId: asPartId(value.a.partId), socketId: value.a.socketId }, b: { partId: asPartId(value.b.partId), socketId: value.b.socketId }, joint: { type: value.joint.type, ...(value.joint.axis === undefined ? {} : { axis: [...value.joint.axis] as [number, number, number] }), ...(value.joint.limits === undefined ? {} : { limits: [...value.joint.limits] as unknown as [number, number] }) } });
  }

  const controlBindings: Array<MachineBlueprint["controlBindings"][number]> = [];
  const bindingIds = new Set<string>();
  const bindingTargets = new Set<string>();
  for (let index = 0; index < rawBindings.length; index += 1) {
    const value = rawBindings[index];
    if (!object(value) || typeof value.id !== "string" || value.id.trim().length === 0 || typeof value.action !== "string" || value.action.trim().length === 0 || typeof value.partId !== "string" || value.partId.trim().length === 0 || typeof value.capability !== "string" || value.capability.trim().length === 0) return fail("building.blueprint.invalid-control-binding", `controlBindings[${String(index)}]`);
    if (bindingIds.has(value.id)) return fail("building.control.duplicate-id", `controlBindings[${String(index)}].id`);
    if (!partIds.has(value.partId)) return fail("building.blueprint.dangling-binding", `controlBindings[${String(index)}].partId`);
    if (value.parameters !== undefined && (!object(value.parameters) || !jsonValue(value.parameters))) return fail("building.control.invalid", `controlBindings[${String(index)}].parameters`);
    const target = JSON.stringify([value.action, value.partId, value.capability]);
    if (bindingTargets.has(target)) return fail("building.control.duplicate-target", `controlBindings[${String(index)}]`);
    bindingIds.add(value.id);
    bindingTargets.add(target);
    controlBindings.push({ id: asControlBindingId(value.id), action: value.action, partId: asPartId(value.partId), capability: value.capability, ...(value.parameters === undefined ? {} : { parameters: value.parameters }) });
  }
  const blueprint = cloneBlueprint({ schemaVersion: 1, id: asMachineId(input.id), version: input.version, parts, connections, controlBindings });
  return catalog === undefined ? { ok: true, value: blueprint } : validateBlueprintSemantics(blueprint, catalog);
}

function compatible(left: SocketDefinition, right: SocketDefinition): boolean {
  const leftTags = new Set([left.id, ...(left.tags ?? [])]);
  const rightTags = new Set([right.id, ...(right.tags ?? [])]);
  return left.accepts.some((tag) => rightTags.has(tag)) && right.accepts.some((tag) => leftTags.has(tag));
}

export function validateBlueprintSemantics(blueprint: MachineBlueprint, catalog: BlueprintCatalog): Result<MachineBlueprint, BlueprintValidationError> {
  const definitions = new Map<string, PartDefinition>();
  const normalizedParts = blueprint.parts.map((part) => part);
  for (const [index, part] of blueprint.parts.entries()) {
    const definition = catalog.resolvePart(part.definitionId);
    if (definition === undefined) return fail("building.part.definition-not-found", `parts.${part.id}.definitionId`);
    const configuration = normalizePartConfiguration(definition, part.configuration);
    if (!configuration.ok) return fail(configuration.code, configuration.field === undefined ? `parts.${part.id}.configuration` : `parts.${part.id}.configuration.${configuration.field}`);
    normalizedParts[index] = { ...part, ...(configuration.value === undefined ? {} : { configuration: configuration.value }) };
    definitions.set(part.id, definition);
  }
  const occupied = new Set<string>();
  for (const connection of blueprint.connections) {
    const leftDefinition = definitions.get(connection.a.partId);
    const rightDefinition = definitions.get(connection.b.partId);
    const leftSocket = leftDefinition?.sockets.find((socket) => socket.id === connection.a.socketId);
    const rightSocket = rightDefinition?.sockets.find((socket) => socket.id === connection.b.socketId);
    if (leftSocket === undefined || rightSocket === undefined) return fail("building.socket.not-found", `connections.${connection.id}`);
    if (connection.a.partId === connection.b.partId && leftDefinition?.allowSelfConnection !== true) return fail("building.connection.self-connection", `connections.${connection.id}`);
    if (!compatible(leftSocket, rightSocket)) return fail("building.socket.incompatible", `connections.${connection.id}`);
    const leftKey = JSON.stringify([connection.a.partId, connection.a.socketId]);
    const rightKey = JSON.stringify([connection.b.partId, connection.b.socketId]);
    if ((leftSocket.singleUse !== false && occupied.has(leftKey)) || (rightSocket.singleUse !== false && occupied.has(rightKey))) return fail("building.socket.occupied", `connections.${connection.id}`);
    if (leftSocket.singleUse !== false) occupied.add(leftKey);
    if (rightSocket.singleUse !== false) occupied.add(rightKey);
  }
  for (const binding of blueprint.controlBindings) {
    const definition = definitions.get(binding.partId);
    if (definition === undefined || !definition.capabilities.includes(binding.capability)) return fail("building.control.capability-not-found", `controlBindings.${binding.id}.capability`);
  }
  const semanticBindingTargets = new Set<string>();
  for (const binding of blueprint.controlBindings) {
    const target = JSON.stringify([binding.action, binding.partId, binding.capability]);
    if (semanticBindingTargets.has(target)) return fail("building.control.duplicate-target", `controlBindings.${binding.id}`);
    semanticBindingTargets.add(target);
  }
  return { ok: true, value: cloneBlueprint({ ...blueprint, parts: normalizedParts }) };
}

export function exportMachineBlueprint(blueprint: MachineBlueprint): MachineBlueprint {
  return cloneBlueprint(blueprint);
}
