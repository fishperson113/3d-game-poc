import type { Vector3Tuple } from "../../kernel/math";

export interface SocketDefinition {
  readonly id: string;
  readonly accepts: readonly string[];
  readonly position: Vector3Tuple;
}

export interface PartDefinition {
  readonly id: string;
  readonly version: number;
  readonly sockets: readonly SocketDefinition[];
  readonly capabilities: readonly string[];
}

// TODO(plan-02): Add body, collider and connection-policy contracts.
