import * as RAPIER from "@dimforge/rapier3d-compat";
import { FIXED_TIMESTEP_SECONDS } from "../../kernel/runtime-contract";
import { quaternionFromEuler, type TransformSnapshot } from "../../kernel/math";
import type { SimulationFrame } from "../../simulation/ports/simulation-renderer";
import type { PhysicsActuatorSpec, PhysicsJointSpec, PhysicsSpecification, PhysicsWorld, PhysicsWorldStats } from "../../simulation/ports/physics-world";
import type { RuntimeTelemetrySink } from "../../simulation/ports/runtime-telemetry";

type RapierBody = RAPIER.RigidBody;
type RapierJoint = RAPIER.ImpulseJoint;

let rapierReady: Promise<void> | undefined;
let activeWorldCount = 0;

export interface RapierPhysicsWorldOptions {
  readonly telemetry?: RuntimeTelemetrySink;
}

export function initializeRapier(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

function rotation(value: readonly [number, number, number, number]): RAPIER.Rotation {
  return { x: value[0], y: value[1], z: value[2], w: value[3] };
}

function vector(value: readonly [number, number, number]): RAPIER.Vector {
  return { x: value[0], y: value[1], z: value[2] };
}

function snapshotBody(body: RapierBody): TransformSnapshot {
  const position = body.translation();
  const quaternion = body.rotation();
  return { position: [position.x, position.y, position.z], rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] };
}

export class RapierPhysicsWorld implements PhysicsWorld {
  private world: RAPIER.World | undefined;
  private readonly bodies = new Map<string, RapierBody>();
  private readonly joints = new Map<string, RapierJoint>();
  private readonly colliderLabels = new Map<number, string>();
  private readonly actuators = new Map<string, PhysicsActuatorSpec>();
  private readonly telemetry: RuntimeTelemetrySink | undefined;
  private eventQueue: RAPIER.EventQueue | undefined;
  private controls = { throttle: 0, steering: 0 };
  private stepCount = 0;

  public constructor(options: RapierPhysicsWorldOptions = {}) {
    this.telemetry = options.telemetry;
  }

  public initialize(specification: PhysicsSpecification): void {
    if (this.world !== undefined) throw new Error("simulation.world.already-initialized");
    const world = new RAPIER.World(vector(specification.environment.gravity));
    const eventQueue = new RAPIER.EventQueue(true);
    world.timestep = FIXED_TIMESTEP_SECONDS;
    world.numSolverIterations = 8;
    try {
      this.createEnvironment(world, specification);
      for (const bodySpec of specification.bodies) {
        const bodyRotation = quaternionFromEuler(bodySpec.transform.rotation);
        const descriptor = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(bodySpec.transform.position[0], bodySpec.transform.position[1], bodySpec.transform.position[2])
          .setRotation(rotation(bodyRotation))
          .setAdditionalMass(bodySpec.physics.body.mass)
          .setLinearDamping(bodySpec.physics.body.linearDamping)
          .setAngularDamping(bodySpec.physics.body.angularDamping)
          .setCanSleep(false)
          .setCcdEnabled(bodySpec.id.includes("wheel"));
        const body = world.createRigidBody(descriptor);
        body.userData = { partId: bodySpec.id };
        this.bodies.set(bodySpec.id, body);
        for (const collider of bodySpec.physics.colliders) {
          let descriptorCollider: RAPIER.ColliderDesc;
          if (collider.shape === "cuboid") {
            const halfExtents = collider.halfExtents;
            if (halfExtents === undefined) throw new Error("simulation.collider.missing-half-extents");
            descriptorCollider = RAPIER.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2]);
          } else {
            if (collider.halfHeight === undefined || collider.radius === undefined) throw new Error("simulation.collider.missing-cylinder-size");
            descriptorCollider = RAPIER.ColliderDesc.cylinder(collider.halfHeight, collider.radius);
          }
          // Part bodies share the same machine and should not collide with one
          // another. They still collide with the default-group ground/ramp.
          // Without this filter, a wheel intersecting the chassis produces
          // artificial torque through contacts that are outside its joint.
          descriptorCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(0x00020001);
          descriptorCollider.setTranslation(collider.position[0], collider.position[1], collider.position[2]);
          descriptorCollider.setRotation(rotation(quaternionFromEuler(collider.rotation)));
          descriptorCollider.setFriction(collider.friction).setRestitution(collider.restitution);
          const createdCollider = world.createCollider(descriptorCollider, body);
          this.colliderLabels.set(createdCollider.handle, bodySpec.id);
        }
      }
      for (const jointSpec of specification.joints) this.createJoint(world, jointSpec);
      for (const actuator of specification.actuators) this.actuators.set(actuator.bindingId, actuator);
      this.world = world;
      this.eventQueue = eventQueue;
      activeWorldCount += 1;
    } catch (error) {
      eventQueue.free();
      world.free();
      this.bodies.clear();
      this.joints.clear();
      this.colliderLabels.clear();
      this.actuators.clear();
      throw error;
    }
  }

  public setControls(control: { readonly throttle: number; readonly steering: number }): void {
    this.controls = { throttle: Math.max(-1, Math.min(1, control.throttle)), steering: Math.max(-1, Math.min(1, control.steering)) };
    for (const actuator of this.actuators.values()) {
      const joint = this.joints.get(actuator.jointId);
      if (joint === undefined) continue;
      const revolute = joint as RAPIER.RevoluteImpulseJoint;
      if (actuator.action === "drive") {
        revolute.configureMotorVelocity(this.controls.throttle * actuator.targetSpeed * actuator.motorSign, 5);
        revolute.setMotorMaxForce(actuator.maxForce);
      } else {
        const target = this.controls.steering * (actuator.limitRadians ?? 0.6);
        revolute.configureMotorPosition(target, actuator.steeringStiffness ?? 80, actuator.steeringDamping ?? 8);
        revolute.setMotorMaxForce(actuator.maxForce);
        if (actuator.limitRadians !== undefined) revolute.setLimits(-actuator.limitRadians, actuator.limitRadians);
      }
    }
  }

  public step(timestepSeconds: number): void {
    if (this.world === undefined) return;
    this.world.timestep = timestepSeconds;
    this.setControls(this.controls);
    this.world.step(this.eventQueue);
    this.stepCount += 1;
    this.eventQueue?.drainCollisionEvents((handleA, handleB, started) => {
      const labelA = this.colliderLabels.get(handleA);
      const labelB = this.colliderLabels.get(handleB);
      if (labelA === undefined || labelB === undefined) return;
      const labels = [labelA, labelB].sort();
      this.publish({ type: started ? "physics.collision.started" : "physics.collision.stopped", payload: { bodyA: labels[0] ?? labelA, bodyB: labels[1] ?? labelB, phase: started ? "started" : "stopped", physicsStep: this.stepCount }, severity: "debug", tags: ["physics", "physics.collision"] });
    });
  }

  public snapshot(): SimulationFrame {
    const transforms: Record<string, TransformSnapshot> = {};
    for (const [id, body] of this.bodies) transforms[id] = snapshotBody(body);
    return { step: this.stepCount, transforms };
  }

  public getStats(): PhysicsWorldStats {
    return { bodies: this.bodies.size, joints: this.joints.size, steps: this.stepCount };
  }

  public dispose(): void {
    if (this.eventQueue !== undefined) {
      this.eventQueue.free();
      this.eventQueue = undefined;
    }
    if (this.world !== undefined) {
      this.world.free();
      this.world = undefined;
      activeWorldCount = Math.max(0, activeWorldCount - 1);
    }
    this.bodies.clear();
    this.joints.clear();
    this.colliderLabels.clear();
    this.actuators.clear();
    this.controls = { throttle: 0, steering: 0 };
    this.stepCount = 0;
  }

  public static getActiveWorldCount(): number { return activeWorldCount; }

  private createEnvironment(world: RAPIER.World, specification: PhysicsSpecification): void {
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(specification.environment.ground.position[0], specification.environment.ground.position[1], specification.environment.ground.position[2]));
    const groundSize = specification.environment.ground.halfExtents;
    const groundCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(groundSize[0], groundSize[1], groundSize[2]).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setFriction(1.5), ground);
    this.colliderLabels.set(groundCollider.handle, "environment.ground");
    const ramp = specification.environment.ramp;
    const rampBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(ramp.position[0], ramp.position[1], ramp.position[2]).setRotation(rotation(quaternionFromEuler(ramp.rotation))));
    const rampCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(ramp.halfExtents[0], ramp.halfExtents[1], ramp.halfExtents[2]).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setFriction(1.3), rampBody);
    this.colliderLabels.set(rampCollider.handle, "environment.ramp");
  }

  private createJoint(world: RAPIER.World, spec: PhysicsJointSpec): void {
    const bodyA = this.bodies.get(spec.bodyA);
    const bodyB = this.bodies.get(spec.bodyB);
    if (bodyA === undefined || bodyB === undefined) throw new Error("simulation.joint.body-missing");
    const anchorA = vector(spec.anchorA);
    const anchorB = vector(spec.anchorB);
    const jointData = spec.type === "fixed"
      ? RAPIER.JointData.fixed(anchorA, RAPIER.RotationOps.identity(), anchorB, RAPIER.RotationOps.identity())
      : RAPIER.JointData.revoluteWithAxes(anchorA, anchorB, vector(spec.axisA ?? [1, 0, 0]), vector(spec.axisB ?? [1, 0, 0]));
    const joint = world.createImpulseJoint(jointData, bodyA, bodyB, true);
    joint.setContactsEnabled(spec.contactsEnabled);
    if (spec.limits !== undefined && spec.type === "revolute") (joint as RAPIER.RevoluteImpulseJoint).setLimits(spec.limits[0], spec.limits[1]);
    this.joints.set(spec.id, joint);
  }

  private publish(event: Parameters<RuntimeTelemetrySink>[0]): void {
    try {
      this.telemetry?.(event);
    } catch {
      // Telemetry must never break the physics step.
    }
  }
}
