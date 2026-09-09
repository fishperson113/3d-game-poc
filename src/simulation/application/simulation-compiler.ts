import type { MachineBlueprint, PartInstance } from "../../building/domain/contracts";
import type { PartDefinition } from "../../building/domain/part-definition";
import { quaternionConjugate, quaternionFromEuler, rotateVector, subtractVector, tupleDistance, worldSocketFrame, type Vector3Tuple } from "../../kernel/math";
import type { EventPublisher } from "../../kernel/events/contracts";
import type { RuntimePartCatalog } from "../../parts/catalog";
import type { PartPhysicsDefinition } from "../../parts/manifest";
import type { PhysicsActuatorSpec, PhysicsBodySpec, PhysicsJointSpec, PhysicsSpecification, PhysicsWorld, SimulationEnvironment } from "../ports/physics-world";

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

function actuatorJoint(blueprint: MachineBlueprint, partId: string, action: "drive" | "steer"): MachineBlueprint["connections"][number] | undefined {
  return blueprint.connections.find((connection) => {
    if (connection.joint.type !== "revolute") return false;
    const containsPart = String(connection.a.partId) === partId || String(connection.b.partId) === partId;
    if (!containsPart) return false;
    if (action === "drive") return connection.joint.axis?.[0] !== 0;
    return connection.joint.axis?.[1] !== 0;
  });
}

function buildActuators(blueprint: MachineBlueprint, catalog: RuntimePartCatalog): { ok: true; value: readonly PhysicsActuatorSpec[] } | { ok: false; error: SimulationCompileError } {
  const actuators: PhysicsActuatorSpec[] = [];
  for (const binding of blueprint.controlBindings.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
    if (binding.action !== "drive" && binding.action !== "steer") continue;
    const part = findPart(blueprint, String(binding.partId));
    if (part === undefined) return error("simulation.compile.binding-part-missing", { bindingId: String(binding.id) });
    const physics = findPhysics(catalog, part);
    if (physics?.actuator === undefined || (binding.action === "drive" && physics.actuator.kind !== "wheel") || (binding.action === "steer" && physics.actuator.kind !== "steering")) return error("simulation.compile.binding-actuator-mismatch", { bindingId: String(binding.id) });
    const joint = actuatorJoint(blueprint, String(part.id), binding.action);
    if (joint === undefined) return error("simulation.compile.binding-joint-missing", { bindingId: String(binding.id) });
    const worldAxis = rotateVector(quaternionFromEuler(part.transform.rotation), physics.actuator.axis);
    const motorSign = binding.action === "drive" ? (worldAxis[0] >= 0 ? -1 : 1) : 1;
    const configuredTorque = part.configuration?.motorTorque;
    const maxForce = typeof configuredTorque === "number" ? Math.max(0, Math.min(100, configuredTorque)) : physics.actuator.maxForce;
    actuators.push({ bindingId: String(binding.id), action: binding.action, partId: String(part.id), jointId: String(joint.id), axis: physics.actuator.axis, maxForce, targetSpeed: physics.actuator.targetSpeed, ...(physics.actuator.limitRadians === undefined ? {} : { limitRadians: physics.actuator.limitRadians }), ...(physics.actuator.stiffness === undefined ? {} : { steeringStiffness: physics.actuator.stiffness }), ...(physics.actuator.damping === undefined ? {} : { steeringDamping: physics.actuator.damping }), motorSign });
  }
  if (!actuators.some((actuator) => actuator.action === "drive")) return error("simulation.compile.drive-binding-missing");
  if (!actuators.some((actuator) => actuator.action === "steer")) return error("simulation.compile.steer-binding-missing");
  return { ok: true, value: Object.freeze(actuators) };
}

export function defaultSimulationEnvironment(): SimulationEnvironment {
  return { gravity: [0, -9.81, 0], spawn: [0, 1.55, 0], ground: { halfExtents: [14, 0.15, 14], position: [0, -0.15, 0] }, ramp: { halfExtents: [3, 0.22, 1.8], position: [0, 0.28, 5], rotation: [-0.22, 0, 0] } };
}

export class SimulationCompiler {
  public constructor(private readonly dependencies: SimulationCompilerDependencies) {}

  public compile(blueprint: MachineBlueprint, environment: SimulationEnvironment = defaultSimulationEnvironment()): { ok: true; value: CompiledSimulation } | { ok: false; error: SimulationCompileError } {
    if (blueprint.parts.length === 0) return error("simulation.compile.empty-machine");
    if (!graphIsConnected(blueprint)) return error("simulation.compile.disconnected-machine");
    const bodySpecs: PhysicsBodySpec[] = [];
    for (const part of blueprint.parts.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const physics = findPhysics(this.dependencies.catalog, part);
      if (physics === undefined) return error("simulation.compile.physics-metadata-missing", { partId: String(part.id) });
      bodySpecs.push({ id: String(part.id), transform: part.transform, physics });
    }
    const joints: PhysicsJointSpec[] = [];
    for (const connection of blueprint.connections.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const resolved = connectionJoint(blueprint, this.dependencies.catalog, connection);
      if ("code" in resolved) return { ok: false, error: resolved };
      const axisA = resolved.axis === undefined ? undefined : localAxis(resolved.bodyA, resolved.axis);
      const axisB = resolved.axis === undefined ? undefined : localAxis(resolved.bodyB, resolved.axis);
      if (resolved.axis !== undefined && (axisA === undefined || axisB === undefined)) return error("simulation.compile.axis-invalid", { connectionId: String(connection.id) });
      joints.push({ id: String(connection.id), type: connection.joint.type, bodyA: String(connection.a.partId), bodyB: String(connection.b.partId), anchorA: localPoint(resolved.bodyA, resolved.anchor), anchorB: localPoint(resolved.bodyB, resolved.anchor), ...(axisA === undefined ? {} : { axisA }), ...(axisB === undefined ? {} : { axisB }), ...(connection.joint.limits === undefined ? {} : { limits: connection.joint.limits }), contactsEnabled: false });
    }
    const actuators = buildActuators(blueprint, this.dependencies.catalog);
    if (!actuators.ok) return actuators;
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
