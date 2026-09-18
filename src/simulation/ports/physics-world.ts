import type { PartTransform } from "../../building/domain/contracts";
import type { QuaternionTuple, Vector3Tuple } from "../../kernel/math";
import type { PartPhysicsDefinition } from "../../parts/manifest";
import type { SimulationFrame } from "./simulation-renderer";

export interface ObstacleSpec {
  readonly id: string;
  readonly shape: "cuboid" | "cylinder";
  readonly position: Vector3Tuple;
  readonly rotation?: Vector3Tuple;
  readonly halfExtents?: Vector3Tuple;
  readonly radius?: number;
  readonly halfHeight?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly color?: number;
  readonly semantic?: string;
}

export interface GoalZoneSpec {
  readonly position: Vector3Tuple;
  readonly size: Vector3Tuple;
}

export interface ChallengePayloadSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
}

export interface SimulationEnvironment {
  readonly gravity: Vector3Tuple;
  readonly spawn: Vector3Tuple;
  readonly ground: { readonly halfExtents: Vector3Tuple; readonly position: Vector3Tuple };
  readonly ramp?: { readonly halfExtents: Vector3Tuple; readonly position: Vector3Tuple; readonly rotation: Vector3Tuple } | undefined;
  readonly obstacles?: readonly ObstacleSpec[] | undefined;
  readonly goalZone?: GoalZoneSpec | undefined;
  readonly payload?: ChallengePayloadSpec | undefined;
}

export interface DefaultSimulationEnvironment extends SimulationEnvironment {
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
  /** Local joint frames used by fixed connections to preserve initial orientation. */
  readonly frameRotationA?: QuaternionTuple;
  readonly frameRotationB?: QuaternionTuple;
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
  readonly bodyMasses?: Readonly<Record<string, number>>;
}

export interface PhysicsWorld {
  initialize(specification: PhysicsSpecification): void;
  setControls(control: { readonly throttle: number; readonly steering: number }): void;
  step(timestepSeconds: number): void;
  snapshot(): SimulationFrame;
  getStats(): PhysicsWorldStats;
  dispose(): void;
}
