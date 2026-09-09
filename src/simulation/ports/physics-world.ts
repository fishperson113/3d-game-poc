import type { PartTransform } from "../../building/domain/contracts";
import type { Vector3Tuple } from "../../kernel/math";
import type { PartPhysicsDefinition } from "../../parts/manifest";
import type { SimulationFrame } from "./simulation-renderer";

export interface SimulationEnvironment {
  readonly gravity: Vector3Tuple;
  readonly spawn: Vector3Tuple;
  readonly ground: { readonly halfExtents: Vector3Tuple; readonly position: Vector3Tuple };
  readonly ramp: { readonly halfExtents: Vector3Tuple; readonly position: Vector3Tuple; readonly rotation: Vector3Tuple };
}

export interface PhysicsBodySpec {
  readonly id: string;
  readonly transform: PartTransform;
  readonly physics: PartPhysicsDefinition;
}

export interface PhysicsJointSpec {
  readonly id: string;
  readonly type: "fixed" | "revolute";
  readonly bodyA: string;
  readonly bodyB: string;
  readonly anchorA: Vector3Tuple;
  readonly anchorB: Vector3Tuple;
  readonly axisA?: Vector3Tuple;
  readonly axisB?: Vector3Tuple;
  readonly limits?: readonly [number, number];
  readonly contactsEnabled: boolean;
}

export interface PhysicsActuatorSpec {
  readonly bindingId: string;
  readonly action: "drive" | "steer";
  readonly partId: string;
  readonly jointId: string;
  readonly axis: Vector3Tuple;
  readonly maxForce: number;
  readonly targetSpeed: number;
  readonly limitRadians?: number;
  readonly steeringStiffness?: number;
  readonly steeringDamping?: number;
  readonly motorSign: number;
}

export interface PhysicsSpecification {
  readonly schemaVersion: 1;
  readonly environment: SimulationEnvironment;
  readonly bodies: readonly PhysicsBodySpec[];
  readonly joints: readonly PhysicsJointSpec[];
  readonly actuators: readonly PhysicsActuatorSpec[];
}

export interface PhysicsWorldStats {
  readonly bodies: number;
  readonly joints: number;
  readonly steps: number;
}

export interface PhysicsWorld {
  initialize(specification: PhysicsSpecification): void;
  setControls(control: { readonly throttle: number; readonly steering: number }): void;
  step(timestepSeconds: number): void;
  snapshot(): SimulationFrame;
  getStats(): PhysicsWorldStats;
  dispose(): void;
}
