import type { JsonValue } from "../../kernel/json";
import type { Result } from "../../kernel/result";
import { asConnectionId, asMachineId, asPartId, asControlBindingId, type Connection, type ConnectionInput, type ControlBinding, type ControlBindingInput, type DomainEvent, type MachineBlueprint, type MachineCommandError, type MachineMode, type PartInstance, type PartTransform, type RotationAxis, type SocketRef } from "./contracts";
import { normalizePartConfiguration, type PartDefinition, type SocketDefinition } from "./part-definition";
import { parseMachineBlueprint } from "./blueprint";

export interface MachineDependencies {
  readonly resolvePart: (definitionId: string) => PartDefinition | undefined;
}

export interface AddPartInput {
  readonly id: string;
  readonly definitionId: string;
  readonly transform: PartTransform;
  readonly configuration?: Readonly<Record<string, JsonValue>>;
}

export interface MachineChange {
  readonly events: readonly DomainEvent[];
  readonly blueprint: MachineBlueprint;
}

const QUARTER_TURN = Math.PI / 2;
const HALF_TURN = Math.PI;

function error(code: string, details?: Readonly<Record<string, JsonValue>>): MachineCommandError {
  return details === undefined ? { code } : { code, details };
}

function isFiniteTuple(value: readonly number[], length: number): boolean {
  return value.length === length && Array.from(value).every((item) => Number.isFinite(item));
}

function isValidTransform(transform: PartTransform): boolean {
  return isFiniteTuple(transform.position, 3) && isFiniteTuple(transform.rotation, 3);
}

function isJsonValue(value: unknown, seen = new WeakSet<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  const prototype = Reflect.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, seen))
    : Object.values(value).every((entry) => isJsonValue(entry, seen));
  seen.delete(value);
  return valid;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => cloneJson(entry));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJson(entry)]));
  return value;
}

export function cloneBlueprint(blueprint: MachineBlueprint): MachineBlueprint {
  return {
    schemaVersion: 1,
    id: blueprint.id,
    version: blueprint.version,
    parts: blueprint.parts.map((part) => ({
      id: part.id,
      definitionId: part.definitionId,
      transform: { position: [...part.transform.position] as PartTransform["position"], rotation: [...part.transform.rotation] as PartTransform["rotation"] },
      ...(part.configuration === undefined ? {} : { configuration: cloneJson(part.configuration) as Readonly<Record<string, JsonValue>> }),
    })),
    connections: blueprint.connections.map((connection) => ({
      id: connection.id,
      a: { ...connection.a },
      b: { ...connection.b },
      joint: {
        type: connection.joint.type,
        ...(connection.joint.axis === undefined ? {} : { axis: [...connection.joint.axis] as PartTransform["position"] }),
        ...(connection.joint.limits === undefined ? {} : { limits: [...connection.joint.limits] as [number, number] }),
      },
    })),
    controlBindings: blueprint.controlBindings.map((binding) => ({
      id: binding.id,
      action: binding.action,
      partId: binding.partId,
      capability: binding.capability,
      ...(binding.parameters === undefined ? {} : { parameters: cloneJson(binding.parameters) as Readonly<Record<string, JsonValue>> }),
    })),
  };
}

function sameEndpoint(left: SocketRef, right: SocketRef): boolean {
  return left.partId === right.partId && left.socketId === right.socketId;
}

function socketFor(blueprint: MachineBlueprint, dependencies: MachineDependencies, reference: SocketRef): { part: PartInstance; definition: PartDefinition; socket: SocketDefinition } | undefined {
  const part = blueprint.parts.find((candidate) => candidate.id === reference.partId);
  if (part === undefined) return undefined;
  const definition = dependencies.resolvePart(part.definitionId);
  if (definition === undefined) return undefined;
  const socket = definition.sockets.find((candidate) => candidate.id === reference.socketId);
  return socket === undefined ? undefined : { part, definition, socket };
}

function socketsCompatible(left: SocketDefinition, right: SocketDefinition): boolean {
  const leftTags = new Set([left.id, ...(left.tags ?? [])]);
  const rightTags = new Set([right.id, ...(right.tags ?? [])]);
  return left.accepts.some((tag) => rightTags.has(tag)) && right.accepts.some((tag) => leftTags.has(tag));
}

function normalizeAngle(value: number): number {
  let angle = ((value + HALF_TURN) % (2 * HALF_TURN)) - HALF_TURN;
  if (angle <= -HALF_TURN) angle += 2 * HALF_TURN;
  return Object.is(angle, -0) ? 0 : angle;
}

function event(type: string, payload: JsonValue): DomainEvent {
  return { type, payload };
}

export class Machine {
  private state: MachineBlueprint;
  private currentMode: MachineMode = "Building";

  private constructor(blueprint: MachineBlueprint, public readonly dependencies: MachineDependencies) {
    this.state = cloneBlueprint(blueprint);
  }

  public static create(id: string, dependencies: MachineDependencies): Result<Machine, MachineCommandError> {
    if (id.trim().length === 0) return { ok: false, error: error("building.machine.invalid-id") };
    return { ok: true, value: new Machine({ schemaVersion: 1, id: asMachineId(id), version: 0, parts: [], connections: [], controlBindings: [] }, dependencies) };
  }

  public static restore(input: unknown, dependencies: MachineDependencies): Result<Machine, MachineCommandError> {
    const parsed = parseMachineBlueprint(input, dependencies);
    if (!parsed.ok) return { ok: false, error: { code: parsed.error.code, ...(parsed.error.path === undefined ? {} : { details: { path: parsed.error.path } }) } };
    return { ok: true, value: new Machine(parsed.value, dependencies) };
  }

  public get blueprint(): MachineBlueprint {
    return cloneBlueprint(this.state);
  }

  public get mode(): MachineMode {
    return this.currentMode;
  }

  public setMode(mode: MachineMode): void {
    this.currentMode = mode;
  }

  public addPart(input: AddPartInput): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (input.id.trim().length === 0) return { ok: false, error: error("building.part.invalid-id") };
    if (this.state.parts.some((part) => part.id === input.id)) return { ok: false, error: error("building.part.duplicate-id", { partId: input.id }) };
    if (!isValidTransform(input.transform)) return { ok: false, error: error("building.transform.invalid") };
    if (input.configuration !== undefined && (!isObject(input.configuration) || !isJsonValue(input.configuration))) return { ok: false, error: error("building.part.configuration-invalid", { partId: input.id }) };
    const definition = this.dependencies.resolvePart(input.definitionId);
    if (definition === undefined) return { ok: false, error: error("building.part.definition-not-found", { definitionId: input.definitionId }) };
    const normalizedConfiguration = normalizePartConfiguration(definition, input.configuration);
    if (!normalizedConfiguration.ok) return { ok: false, error: error(normalizedConfiguration.code, normalizedConfiguration.field === undefined ? { partId: input.id } : { partId: input.id, field: normalizedConfiguration.field }) };
    const part: PartInstance = {
      id: asPartId(input.id),
      definitionId: input.definitionId,
      transform: { position: [...input.transform.position] as PartTransform["position"], rotation: [...input.transform.rotation] as PartTransform["rotation"] },
      ...(normalizedConfiguration.value === undefined ? {} : { configuration: cloneJson(normalizedConfiguration.value) as Readonly<Record<string, JsonValue>> }),
    };
    this.state = { ...this.state, version: this.state.version + 1, parts: [...this.state.parts, part] };
    return this.changed(event("building.part.added", { machineId: this.state.id, partId: part.id, definitionId: part.definitionId }));
  }

  public removePart(partId: string): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (!this.state.parts.some((part) => part.id === partId)) return { ok: false, error: error("building.part.not-found", { partId }) };
    const removedConnectionIds = this.state.connections.filter((connection) => connection.a.partId === partId || connection.b.partId === partId).map((connection) => connection.id);
    const removedBindingIds = this.state.controlBindings.filter((binding) => binding.partId === partId).map((binding) => binding.id);
    this.state = {
      ...this.state,
      version: this.state.version + 1,
      parts: this.state.parts.filter((part) => part.id !== partId),
      connections: this.state.connections.filter((connection) => !removedConnectionIds.includes(connection.id)),
      controlBindings: this.state.controlBindings.filter((binding) => binding.partId !== partId),
    };
    return this.changed(event("building.part.removed", { machineId: this.state.id, partId, removedConnectionIds, removedBindingIds }));
  }

  public movePart(partId: string, transform: PartTransform): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (!isValidTransform(transform)) return { ok: false, error: error("building.transform.invalid") };
    if (!this.state.parts.some((part) => part.id === partId)) return { ok: false, error: error("building.part.not-found", { partId }) };
    this.state = { ...this.state, version: this.state.version + 1, parts: this.state.parts.map((part) => part.id === partId ? { ...part, transform: { position: [...transform.position] as PartTransform["position"], rotation: [...transform.rotation] as PartTransform["rotation"] } } : part) };
    return this.changed(event("building.part.moved", { machineId: this.state.id, partId, transform: { position: [...transform.position], rotation: [...transform.rotation] } }));
  }

  public rotatePart(partId: string, axis: RotationAxis, steps = 1): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (!Number.isSafeInteger(steps)) return { ok: false, error: error("building.rotation.invalid-steps") };
    const part = this.state.parts.find((candidate) => candidate.id === partId);
    if (part === undefined) return { ok: false, error: error("building.part.not-found", { partId }) };
    const axisIndex = ({ x: 0, y: 1, z: 2 } as Record<string, number | undefined>)[axis];
    if (axisIndex === undefined) return { ok: false, error: error("building.rotation.invalid-axis") };
    const rotation = [...part.transform.rotation] as [number, number, number];
    rotation[axisIndex] = normalizeAngle((rotation[axisIndex] ?? 0) + steps * QUARTER_TURN);
    this.state = { ...this.state, version: this.state.version + 1, parts: this.state.parts.map((candidate) => candidate.id === partId ? { ...candidate, transform: { ...candidate.transform, rotation } } : candidate) };
    return this.changed(event("building.part.rotated", { machineId: this.state.id, partId, axis, steps, rotation }));
  }

  public connectParts(input: ConnectionInput): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    const connection: Connection = {
      id: asConnectionId(input.id),
      a: { partId: asPartId(input.a.partId), socketId: input.a.socketId },
      b: { partId: asPartId(input.b.partId), socketId: input.b.socketId },
      joint: input.joint,
    };
    if (connection.id.trim().length === 0 || this.state.connections.some((candidate) => candidate.id === connection.id)) return { ok: false, error: error("building.connection.duplicate-id", { connectionId: connection.id }) };
    if (connection.a.partId === connection.b.partId) {
      const part = this.state.parts.find((candidate) => candidate.id === connection.a.partId);
      const definition = part === undefined ? undefined : this.dependencies.resolvePart(part.definitionId);
      if (definition?.allowSelfConnection !== true) return { ok: false, error: error("building.connection.self-connection") };
    }
    const left = socketFor(this.state, this.dependencies, connection.a);
    const right = socketFor(this.state, this.dependencies, connection.b);
    if (left === undefined || right === undefined) return { ok: false, error: error("building.socket.not-found") };
    if (sameEndpoint(connection.a, connection.b)) return { ok: false, error: error("building.connection.same-socket") };
    if (!socketsCompatible(left.socket, right.socket)) return { ok: false, error: error("building.socket.incompatible") };
    const occupied = (reference: SocketRef, socket: SocketDefinition): boolean => socket.singleUse !== false && this.state.connections.some((candidate) => sameEndpoint(candidate.a, reference) || sameEndpoint(candidate.b, reference));
    if (occupied(connection.a, left.socket) || occupied(connection.b, right.socket)) return { ok: false, error: error("building.socket.occupied") };
    const jointType: string = connection.joint.type;
    if (jointType !== "fixed" && jointType !== "revolute") return { ok: false, error: error("building.joint.invalid-type") };
    if (connection.joint.axis !== undefined && (!isFiniteTuple(connection.joint.axis, 3) || (connection.joint.type === "revolute" && connection.joint.axis.every((component) => component === 0)))) return { ok: false, error: error("building.joint.invalid-axis") };
    if (connection.joint.limits !== undefined && (!isFiniteTuple(connection.joint.limits, 2) || connection.joint.limits[0] > connection.joint.limits[1])) return { ok: false, error: error("building.joint.invalid-limits") };
    this.state = { ...this.state, version: this.state.version + 1, connections: [...this.state.connections, { ...connection, a: { ...connection.a }, b: { ...connection.b }, joint: { ...connection.joint, ...(connection.joint.axis === undefined ? {} : { axis: [...connection.joint.axis] as PartTransform["position"] }), ...(connection.joint.limits === undefined ? {} : { limits: [...connection.joint.limits] as [number, number] }) } }] };
    return this.changed(event("building.parts.connected", { machineId: this.state.id, connectionId: connection.id, a: { partId: connection.a.partId, socketId: connection.a.socketId }, b: { partId: connection.b.partId, socketId: connection.b.socketId }, joint: { type: connection.joint.type, ...(connection.joint.axis === undefined ? {} : { axis: [...connection.joint.axis] }), ...(connection.joint.limits === undefined ? {} : { limits: [...connection.joint.limits] }) } }));
  }

  public disconnect(connectionId: string): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (!this.state.connections.some((connection) => connection.id === connectionId)) return { ok: false, error: error("building.connection.not-found", { connectionId }) };
    this.state = { ...this.state, version: this.state.version + 1, connections: this.state.connections.filter((connection) => connection.id !== connectionId) };
    return this.changed(event("building.parts.disconnected", { machineId: this.state.id, connectionId }));
  }

  public configurePart(partId: string, configuration: Readonly<Record<string, JsonValue>>): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    if (!isObject(configuration) || !isJsonValue(configuration)) return { ok: false, error: error("building.part.configuration-invalid", { partId }) };
    const part = this.state.parts.find((candidate) => candidate.id === partId);
    if (part === undefined) return { ok: false, error: error("building.part.not-found", { partId }) };
    const definition = this.dependencies.resolvePart(part.definitionId);
    if (definition === undefined) return { ok: false, error: error("building.part.definition-not-found", { definitionId: part.definitionId }) };
    const mergedConfiguration = { ...(part.configuration ?? {}), ...configuration };
    const normalizedConfiguration = normalizePartConfiguration(definition, mergedConfiguration);
    if (!normalizedConfiguration.ok) return { ok: false, error: error(normalizedConfiguration.code, normalizedConfiguration.field === undefined ? { partId } : { partId, field: normalizedConfiguration.field }) };
    this.state = { ...this.state, version: this.state.version + 1, parts: this.state.parts.map((candidate) => candidate.id === partId ? { ...candidate, ...(normalizedConfiguration.value === undefined ? {} : { configuration: cloneJson(normalizedConfiguration.value) as Readonly<Record<string, JsonValue>> }) } : candidate) };
    return this.changed(event("building.part.configured", { machineId: this.state.id, partId, configuration: normalizedConfiguration.value ?? {} }));
  }

  public bindControl(input: ControlBindingInput): Result<MachineChange, MachineCommandError> {
    const guard = this.ensureBuilding();
    if (guard !== undefined) return guard;
    const binding: ControlBinding = {
      id: asControlBindingId(input.id),
      action: input.action,
      partId: asPartId(input.partId),
      capability: input.capability,
      ...(input.parameters === undefined ? {} : { parameters: input.parameters }),
    };
    const part = this.state.parts.find((candidate) => candidate.id === binding.partId);
    if (part === undefined) return { ok: false, error: error("building.part.not-found", { partId: binding.partId }) };
    const definition = this.dependencies.resolvePart(part.definitionId);
    if (definition === undefined || !definition.capabilities.includes(binding.capability)) return { ok: false, error: error("building.control.capability-not-found", { capability: binding.capability, partId: binding.partId }) };
    if (binding.id.trim().length === 0 || binding.action.trim().length === 0) return { ok: false, error: error("building.control.invalid") };
    if (binding.parameters !== undefined && (!isObject(binding.parameters) || !isJsonValue(binding.parameters))) return { ok: false, error: error("building.control.invalid") };
    const targetDuplicate = this.state.controlBindings.find((candidate) => candidate.id !== binding.id && candidate.action === binding.action && candidate.partId === binding.partId && candidate.capability === binding.capability);
    if (targetDuplicate !== undefined) return { ok: false, error: error("building.control.duplicate-target", { bindingId: targetDuplicate.id }) };
    const nextBinding: ControlBinding = { ...binding, ...(binding.parameters === undefined ? {} : { parameters: cloneJson(binding.parameters) as Readonly<Record<string, JsonValue>> }) };
    this.state = { ...this.state, version: this.state.version + 1, controlBindings: this.state.controlBindings.some((candidate) => candidate.id === binding.id) ? this.state.controlBindings.map((candidate) => candidate.id === binding.id ? nextBinding : candidate) : [...this.state.controlBindings, nextBinding] };
    return this.changed(event("building.control.bound", { machineId: this.state.id, bindingId: binding.id, action: binding.action, partId: binding.partId, capability: binding.capability }));
  }

  private ensureBuilding(): Result<MachineChange, MachineCommandError> | undefined {
    return this.currentMode === "Building" ? undefined : { ok: false, error: error("building.mode.invalid") };
  }

  private changed(domainEvent: DomainEvent): Result<MachineChange, MachineCommandError> {
    return { ok: true, value: { blueprint: this.blueprint, events: [domainEvent] } };
  }
}
