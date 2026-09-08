import type { Vector3Tuple } from "../../kernel/math";
import type { JsonValue } from "../../kernel/json";
import type { Brand } from "../../kernel/ids";

export type { Vector3Tuple } from "../../kernel/math";

export interface PartTransform {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
}

export type MachineMode = "Building" | "Simulation";
export type RotationAxis = "x" | "y" | "z";

// Boundary identifiers remain serializable strings while carrying distinct compile-time roles.
export type MachineId = Brand<string, "MachineId">;
export type PartId = Brand<string, "PartId">;
export type ConnectionId = Brand<string, "ConnectionId">;
export type ControlBindingId = Brand<string, "ControlBindingId">;

export function asMachineId(value: string): MachineId { return value as MachineId; }
export function asPartId(value: string): PartId { return value as PartId; }
export function asConnectionId(value: string): ConnectionId { return value as ConnectionId; }
export function asControlBindingId(value: string): ControlBindingId { return value as ControlBindingId; }

export interface PartInstance {
  readonly id: PartId;
  readonly definitionId: string;
  readonly transform: PartTransform;
  readonly configuration?: Readonly<Record<string, JsonValue>>;
}

export interface SocketRef {
  readonly partId: PartId;
  readonly socketId: string;
}

export interface JointSpec {
  readonly type: "fixed" | "revolute";
  readonly axis?: Vector3Tuple;
  readonly limits?: readonly [number, number];
}

export interface Connection {
  readonly id: ConnectionId;
  readonly a: SocketRef;
  readonly b: SocketRef;
  readonly joint: JointSpec;
}

export interface ConnectionInput {
  readonly id: string;
  readonly a: { readonly partId: string; readonly socketId: string };
  readonly b: { readonly partId: string; readonly socketId: string };
  readonly joint: JointSpec;
}

export interface ControlBinding {
  readonly id: ControlBindingId;
  readonly action: string;
  readonly partId: PartId;
  readonly capability: string;
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}

export interface ControlBindingInput {
  readonly id: string;
  readonly action: string;
  readonly partId: string;
  readonly capability: string;
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}

export interface MachineBlueprint {
  readonly schemaVersion: 1;
  readonly id: MachineId;
  readonly version: number;
  readonly parts: readonly PartInstance[];
  readonly connections: readonly Connection[];
  readonly controlBindings: readonly ControlBinding[];
}

export interface DomainEvent {
  readonly type: string;
  readonly payload: JsonValue;
}

export interface MachineCommandError {
  readonly code: string;
  readonly message?: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}
