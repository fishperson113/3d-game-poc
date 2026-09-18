import type { MachineBlueprint, PartInstance } from "../../building/domain/contracts";
import type { PartDefinition } from "../../building/domain/part-definition";
import { quaternionConjugate, quaternionFromEuler, quaternionMultiply, quaternionNormalize, rotateVector, subtractVector, tupleDistance, worldSocketFrame, type QuaternionTuple, type Vector3Tuple } from "../../kernel/math";
import type { EventPublisher } from "../../kernel/events/contracts";
import type { RuntimePartCatalog } from "../../parts/catalog";
import type { PartPhysicsDefinition } from "../../parts/manifest";
import type { DefaultSimulationEnvironment, PhysicsActuatorSpec, PhysicsBodySpec, PhysicsJointSpec, PhysicsSpecification, PhysicsWorld, SimulationEnvironment } from "../ports/physics-world";

export interface SimulationCompileError {
  readonly code: string;
  readonly details?: Readonly<Record<string, string | number>>;
}

export interface CompiledSimulation {
  readonly world: PhysicsWorld;
  readonly specification: PhysicsSpecification;
}

export interface SimulationCompilerDependencies {
  readonly createPhysicsWorld: () => PhysicsWorld;
  readonly catalog: RuntimePartCatalog;
  readonly events: EventPublisher;
}

const ANCHOR_TOLERANCE = 0.025;
const AXIS_TOLERANCE = 1e-6;

function error(code: string, details?: Readonly<Record<string, string | number>>): { ok: false; error: SimulationCompileError } {
  return details === undefined ? { ok: false, error: { code } } : { ok: false, error: { code, details } };
}

function normalizeAxis(value: Vector3Tuple): Vector3Tuple | undefined {
  const length = Math.hypot(value[0], value[1], value[2]);
  return length <= AXIS_TOLERANCE ? undefined : [value[0] / length, value[1] / length, value[2] / length];
}

function localPoint(part: PartInstance, worldPoint: Vector3Tuple): Vector3Tuple {
  const inverse = quaternionConjugate(quaternionFromEuler(part.transform.rotation));
  return rotateVector(inverse, subtractVector(worldPoint, part.transform.position));
}

function localAxis(part: PartInstance, worldAxis: Vector3Tuple): Vector3Tuple | undefined {
  return normalizeAxis(rotateVector(quaternionConjugate(quaternionFromEuler(part.transform.rotation)), worldAxis));
}

function initialFixedFrameA(): QuaternionTuple {
  return [0, 0, 0, 1];
}

function initialFixedFrameB(bodyA: PartInstance, bodyB: PartInstance): QuaternionTuple {
  const bodyRotationA = quaternionFromEuler(bodyA.transform.rotation);
  const bodyRotationB = quaternionFromEuler(bodyB.transform.rotation);
  return quaternionNormalize(quaternionMultiply(quaternionConjugate(bodyRotationB), bodyRotationA));
}

function findPart(blueprint: MachineBlueprint, id: string): PartInstance | undefined {
  return blueprint.parts.find((part) => part.id === id);
}

function findDefinition(catalog: RuntimePartCatalog, part: PartInstance): PartDefinition | undefined {
  return catalog.get(part.definitionId);
}

function findPhysics(catalog: RuntimePartCatalog, part: PartInstance): PartPhysicsDefinition | undefined {
  return catalog.getPhysics(part.definitionId);
}

function connectionJoint(blueprint: MachineBlueprint, catalog: RuntimePartCatalog, connection: MachineBlueprint["connections"][number]): { readonly bodyA: PartInstance; readonly bodyB: PartInstance; readonly definitionA: PartDefinition; readonly definitionB: PartDefinition; readonly axis?: Vector3Tuple; readonly anchor: Vector3Tuple } | SimulationCompileError {
  const bodyA = findPart(blueprint, connection.a.partId);
  const bodyB = findPart(blueprint, connection.b.partId);
  if (bodyA === undefined || bodyB === undefined) return { code: "simulation.compile.dangling-connection", details: { connectionId: String(connection.id) } };
  const definitionA = findDefinition(catalog, bodyA);
  const definitionB = findDefinition(catalog, bodyB);
  if (definitionA === undefined || definitionB === undefined) return { code: "simulation.compile.part-definition-missing", details: { connectionId: String(connection.id) } };
  const socketA = definitionA.sockets.find((socket) => socket.id === connection.a.socketId);
  const socketB = definitionB.sockets.find((socket) => socket.id === connection.b.socketId);
  if (socketA === undefined || socketB === undefined) return { code: "simulation.compile.socket-missing", details: { connectionId: String(connection.id) } };
  const frameA = worldSocketFrame(bodyA.transform, socketA);
  const frameB = worldSocketFrame(bodyB.transform, socketB);
  const distance = tupleDistance(frameA.position, frameB.position);
  if (distance > ANCHOR_TOLERANCE) return { code: "simulation.compile.anchor-mismatch", details: { connectionId: String(connection.id), distance } };
  const axis = connection.joint.axis === undefined ? undefined : normalizeAxis(connection.joint.axis);
  if (connection.joint.type === "revolute" && axis === undefined) return { code: "simulation.compile.axis-invalid", details: { connectionId: String(connection.id) } };
  if (connection.joint.limits !== undefined && connection.joint.limits[0] > connection.joint.limits[1]) return { code: "simulation.compile.limits-invalid", details: { connectionId: String(connection.id) } };
  return { bodyA, bodyB, definitionA, definitionB, ...(axis === undefined ? {} : { axis }), anchor: [(frameA.position[0] + frameB.position[0]) / 2, (frameA.position[1] + frameB.position[1]) / 2, (frameA.position[2] + frameB.position[2]) / 2] };
}

function graphIsConnected(blueprint: MachineBlueprint): boolean {
  const first = blueprint.parts[0];
  if (first === undefined) return false;
  const visited = new Set<string>([first.id]);
  const queue = [String(first.id)];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const connection of blueprint.connections) {
      const next = connection.a.partId === current ? connection.b.partId : connection.b.partId === current ? connection.a.partId : undefined;
      if (next !== undefined && !visited.has(next)) {
        visited.add(next);
        queue.push(String(next));
      }
    }
  }
  return visited.size === blueprint.parts.length;
}

interface ColliderBounds { readonly partId: string; readonly min: Vector3Tuple; readonly max: Vector3Tuple }

function colliderBounds(part: PartInstance, physics: PartPhysicsDefinition, spawnOffset: Vector3Tuple): ColliderBounds[] {
  const partRotation = quaternionFromEuler(part.transform.rotation);
  return physics.colliders.map((collider) => {
    const localHalf: Vector3Tuple = collider.shape === "cuboid"
      ? collider.halfExtents ?? [0, 0, 0]
      : [collider.radius ?? 0, collider.halfHeight ?? 0, collider.radius ?? 0];
    const centerOffset = rotateVector(partRotation, collider.position);
    const center: Vector3Tuple = [part.transform.position[0] + spawnOffset[0] + centerOffset[0], part.transform.position[1] + spawnOffset[1] + centerOffset[1], part.transform.position[2] + spawnOffset[2] + centerOffset[2]];
    const colliderRotation = quaternionMultiply(partRotation, quaternionFromEuler(collider.rotation));
    const axes = ([0, 1, 2] as const).map((axis) => rotateVector(colliderRotation, axis === 0 ? [1, 0, 0] : axis === 1 ? [0, 1, 0] : [0, 0, 1]));
    const half = ([0, 1, 2] as const).map((axis) => Math.abs(axes[0]?.[axis] ?? 0) * localHalf[0] + Math.abs(axes[1]?.[axis] ?? 0) * localHalf[1] + Math.abs(axes[2]?.[axis] ?? 0) * localHalf[2]) as unknown as Vector3Tuple;
    return { partId: String(part.id), min: [center[0] - half[0], center[1] - half[1], center[2] - half[2]], max: [center[0] + half[0], center[1] + half[1], center[2] + half[2]] };
  });
}

function penetration(left: ColliderBounds, right: ColliderBounds): number {
  return Math.min(left.max[0] - right.min[0], right.max[0] - left.min[0], left.max[1] - right.min[1], right.max[1] - left.min[1], left.max[2] - right.min[2], right.max[2] - left.min[2]);
}

function validateOverlaps(blueprint: MachineBlueprint, catalog: RuntimePartCatalog, environment: SimulationEnvironment, spawnOffset: Vector3Tuple): SimulationCompileError | undefined {
  const connected = new Set(blueprint.connections.map((connection) => [String(connection.a.partId), String(connection.b.partId)].sort().join("::")));
  const bounds = blueprint.parts.flatMap((part) => {
    const physics = findPhysics(catalog, part);
    return physics === undefined ? [] : colliderBounds(part, physics, spawnOffset);
  });
  const tolerance = 0.005;
  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    const left = bounds[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      const right = bounds[rightIndex];
      if (right === undefined || left.partId === right.partId || connected.has([left.partId, right.partId].sort().join("::"))) continue;
      const depth = penetration(left, right);
      if (depth > tolerance) return { code: "simulation.compile.collider-overlap", details: { partA: left.partId, partB: right.partId, penetration: depth } };
    }
  }
  const environmentBounds: ColliderBounds[] = [
    { partId: "environment.ground", min: [environment.ground.position[0] - environment.ground.halfExtents[0], environment.ground.position[1] - environment.ground.halfExtents[1], environment.ground.position[2] - environment.ground.halfExtents[2]], max: [environment.ground.position[0] + environment.ground.halfExtents[0], environment.ground.position[1] + environment.ground.halfExtents[1], environment.ground.position[2] + environment.ground.halfExtents[2]] },
    ...(environment.ramp === undefined ? [] : colliderBounds({ id: "environment.ramp" as PartInstance["id"], definitionId: "environment", transform: { position: environment.ramp.position, rotation: environment.ramp.rotation } }, { body: { mass: 0, linearDamping: 0, angularDamping: 0 }, colliders: [{ shape: "cuboid", halfExtents: environment.ramp.halfExtents, position: [0, 0, 0], rotation: [0, 0, 0], friction: 0, restitution: 0 }] }, [0, 0, 0])),
  ];
  for (const body of bounds) for (const obstacle of environmentBounds) {
    const depth = penetration(body, obstacle);
    if (depth > tolerance) return { code: "simulation.compile.environment-overlap", details: { partId: body.partId, obstacle: obstacle.partId, penetration: depth } };
  }
  return undefined;
}

function actuatorJoint(blueprint: MachineBlueprint, partId: string, socketId: string | undefined): MachineBlueprint["connections"][number] | undefined {
  const matches = blueprint.connections.filter((connection) => {
    if (connection.joint.type !== "revolute") return false;
    return [connection.a, connection.b].some((endpoint) => endpoint.partId === partId && endpoint.socketId === socketId);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function buildActuators(blueprint: MachineBlueprint, catalog: RuntimePartCatalog): { ok: true; value: readonly PhysicsActuatorSpec[] } | { ok: false; error: SimulationCompileError } {
  const actuators: PhysicsActuatorSpec[] = [];
  for (const binding of blueprint.controlBindings.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
    if (binding.action !== "drive" && binding.action !== "steer") continue;
    const part = findPart(blueprint, String(binding.partId));
    if (part === undefined) return error("simulation.compile.binding-part-missing", { bindingId: String(binding.id) });
    const physics = findPhysics(catalog, part);
    if (physics?.actuator === undefined || (binding.action === "drive" && physics.actuator.kind !== "wheel") || (binding.action === "steer" && physics.actuator.kind !== "steering")) continue;
    const joint = actuatorJoint(blueprint, String(part.id), physics.actuator.socketId);
    if (joint === undefined) continue;
    if (actuators.some((actuator) => actuator.jointId === joint.id)) continue;
    const root = blueprint.parts[0];
    if (root === undefined) return error("simulation.compile.empty-machine");
    const worldAxis = rotateVector(quaternionFromEuler(part.transform.rotation), physics.actuator.axis);
    const referenceAxis = rotateVector(quaternionFromEuler(root.transform.rotation), binding.action === "drive" ? [1, 0, 0] : [0, 1, 0]);
    const alignment = worldAxis.reduce((sum, component, index) => sum + component * (referenceAxis[index] ?? 0), 0);
    const sign = binding.parameters?.sign ?? 1;
    if (sign !== 1 && sign !== -1) return error("simulation.compile.binding-sign-invalid", { bindingId: String(binding.id) });
    const motorSign = (alignment < 0 ? -1 : 1) * sign;
    const configuredTorque = part.configuration?.motorTorque;
    const maxForce = typeof configuredTorque === "number" ? Math.max(0, Math.min(100, configuredTorque)) : physics.actuator.maxForce;
    const configuredLimit = part.configuration?.steeringLimitRadians;
    const limitRadians = typeof configuredLimit === "number" ? configuredLimit : physics.actuator.limitRadians;
    if (limitRadians !== undefined && (!Number.isFinite(limitRadians) || limitRadians < 0 || limitRadians > Math.PI / 2)) return error("simulation.compile.steering-limit-invalid");
    actuators.push({ bindingId: String(binding.id), action: binding.action, partId: String(part.id), jointId: String(joint.id), axis: physics.actuator.axis, maxForce, targetSpeed: physics.actuator.targetSpeed, ...(limitRadians === undefined ? {} : { limitRadians }), ...(physics.actuator.stiffness === undefined ? {} : { steeringStiffness: physics.actuator.stiffness }), ...(physics.actuator.damping === undefined ? {} : { steeringDamping: physics.actuator.damping }), motorSign });
  }
  // An incomplete machine is still a valid sandbox experiment. Compile any
  // valid subset of actuators; absent drive/steer capabilities simply make
  // the corresponding input a no-op until the user adds more parts.
  return { ok: true, value: Object.freeze(actuators) };
}

export function defaultSimulationEnvironment(): DefaultSimulationEnvironment {
  return { gravity: [0, -9.81, 0], spawn: [0, 0.75, 0], ground: { halfExtents: [14, 0.15, 14], position: [0, -0.15, 0] }, ramp: { halfExtents: [3, 0.22, 1.8], position: [0, 0.28, 5], rotation: [-0.22, 0, 0] } };
}

export class SimulationCompiler {
  public constructor(private readonly dependencies: SimulationCompilerDependencies) {}

  public compile(blueprint: MachineBlueprint, environment: SimulationEnvironment = defaultSimulationEnvironment()): { ok: true; value: CompiledSimulation } | { ok: false; error: SimulationCompileError } {
    if (blueprint.parts.length === 0) return error("simulation.compile.empty-machine");
    if (!graphIsConnected(blueprint)) return error("simulation.compile.disconnected-machine");
    const root = blueprint.parts[0];
    if (root === undefined) return error("simulation.compile.empty-machine");
    const spawnOffset: Vector3Tuple = [environment.spawn[0] - root.transform.position[0], environment.spawn[1] - root.transform.position[1], environment.spawn[2] - root.transform.position[2]];
    const overlapError = validateOverlaps(blueprint, this.dependencies.catalog, environment, spawnOffset);
    if (overlapError !== undefined) return { ok: false, error: overlapError };
    const bodySpecs: PhysicsBodySpec[] = [];
    for (const part of blueprint.parts.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const physics = findPhysics(this.dependencies.catalog, part);
      if (physics === undefined) return error("simulation.compile.physics-metadata-missing", { partId: String(part.id) });
      bodySpecs.push({ id: String(part.id), transform: { position: [part.transform.position[0] + spawnOffset[0], part.transform.position[1] + spawnOffset[1], part.transform.position[2] + spawnOffset[2]], rotation: part.transform.rotation }, physics });
    }
    if (environment.payload !== undefined) {
      if (bodySpecs.some((body) => body.id === environment.payload?.id)) return error("simulation.compile.payload-id-conflict", { payloadId: environment.payload.id });
      const payloadPhysics = this.dependencies.catalog.getPhysics(environment.payload.definitionId);
      if (payloadPhysics === undefined) return error("simulation.compile.physics-metadata-missing", { partId: environment.payload.id });
      bodySpecs.push({
        id: environment.payload.id,
        transform: { position: environment.payload.position, rotation: environment.payload.rotation },
        physics: payloadPhysics,
      });
    }
    const joints: PhysicsJointSpec[] = [];
    const actuators = buildActuators(blueprint, this.dependencies.catalog);
    if (!actuators.ok) return actuators;
    for (const connection of blueprint.connections.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const actuator = actuators.value.find((item) => item.jointId === connection.id);
      // Canonical attachment order: support A, actuated part B. Endpoint
      // serialization order must never reverse the meaning of a control.
      const canonical = actuator !== undefined && connection.a.partId === actuator.partId ? { ...connection, a: connection.b, b: connection.a } : connection;
      const resolved = connectionJoint(blueprint, this.dependencies.catalog, canonical);
      if ("code" in resolved) return { ok: false, error: resolved };
      const axis = actuator === undefined ? resolved.axis : rotateVector(quaternionFromEuler(resolved.bodyB.transform.rotation), actuator.axis);
      const axisA = axis === undefined ? undefined : localAxis(resolved.bodyA, axis);
      const axisB = axis === undefined ? undefined : localAxis(resolved.bodyB, axis);
      if (resolved.axis !== undefined && (axisA === undefined || axisB === undefined)) return error("simulation.compile.axis-invalid", { connectionId: String(connection.id) });
      const limits = actuator?.limitRadians === undefined ? connection.joint.limits : [-actuator.limitRadians, actuator.limitRadians] as const;
      joints.push({ id: String(connection.id), type: connection.joint.type, bodyA: String(canonical.a.partId), bodyB: String(canonical.b.partId), anchorA: localPoint(resolved.bodyA, resolved.anchor), anchorB: localPoint(resolved.bodyB, resolved.anchor), ...(connection.joint.type === "fixed" ? { frameRotationA: initialFixedFrameA(), frameRotationB: initialFixedFrameB(resolved.bodyA, resolved.bodyB) } : {}), ...(axisA === undefined ? {} : { axisA }), ...(axisB === undefined ? {} : { axisB }), ...(limits === undefined ? {} : { limits }), contactsEnabled: false });
    }
    const specification: PhysicsSpecification = { schemaVersion: 1, environment, bodies: Object.freeze(bodySpecs), joints: Object.freeze(joints), actuators: actuators.value };
    const world = this.dependencies.createPhysicsWorld();
    try {
      world.initialize(specification);
      return { ok: true, value: { world, specification } };
    } catch {
      world.dispose();
      return error("simulation.compile.physics-allocation-failed");
    }
  }
}

export function serializePhysicsSpecification(specification: PhysicsSpecification): string {
  return JSON.stringify(specification);
}
