import type { JsonPrimitive, JsonValue } from "../kernel/json";
import type { Vector3Tuple } from "../kernel/math";
import type { ConfigurationField, PartConfigurationSchema, PartDefinition, SocketDefinition } from "../building/domain/part-definition";

export const IMG2THREEJS_SOURCE_COMMIT = "6e60b5e22419464b4853e01ddb6c0e6f6659a733";

export type ColliderShape = "cuboid" | "cylinder";
export type PartActuatorKind = "wheel" | "steering";

export interface PartColliderDefinition {
  readonly shape: ColliderShape;
  readonly halfExtents?: Vector3Tuple;
  readonly halfHeight?: number;
  readonly radius?: number;
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
  readonly friction: number;
  readonly restitution: number;
}

export interface PartPhysicsDefinition {
  readonly body: {
    readonly mass: number;
    readonly linearDamping: number;
    readonly angularDamping: number;
  };
  readonly colliders: readonly PartColliderDefinition[];
  readonly actuator?: {
    readonly kind: PartActuatorKind;
    readonly axis: Vector3Tuple;
    readonly maxForce: number;
    readonly targetSpeed: number;
    readonly limitRadians?: number;
    readonly stiffness?: number;
    readonly damping?: number;
  };
}

export interface PartVisualVariant {
  readonly id: string;
  readonly label: string;
  readonly factory: string;
}

export interface PartVisualReference {
  readonly factory: string;
  readonly revision: number;
  readonly source: "img2threejs" | "procedural-brief";
  readonly sourceCommit: string;
  readonly normalization: {
    readonly metersPerUnit: number;
    readonly upAxis: "y";
    readonly forwardAxis: "z";
    readonly origin: "part-frame";
  };
  readonly variants: readonly PartVisualVariant[];
}

export interface PartManifest {
  readonly schemaVersion: 1;
  readonly kind: "core.part";
  readonly id: string;
  readonly revision: number;
  readonly assembly: {
    readonly sockets: readonly SocketDefinition[];
    readonly capabilities: readonly string[];
    readonly allowSelfConnection?: boolean;
    readonly configurationSchema?: PartConfigurationSchema;
  };
  readonly physics: PartPhysicsDefinition;
  readonly visual: PartVisualReference;
  readonly provenance: {
    readonly brief: string;
    readonly reference?: string;
    readonly license: string;
    readonly toolCommit: string;
  };
}

export interface ManifestValidationError {
  readonly code: string;
  readonly path: string;
}

export interface ManifestValidationResult {
  readonly ok: true;
  readonly value: PartManifest;
}

export interface ManifestValidationFailure {
  readonly ok: false;
  readonly error: ManifestValidationError;
}

export type ParsedManifest = ManifestValidationResult | ManifestValidationFailure;

function fail(code: string, path: string): ManifestValidationFailure {
  return { ok: false, error: { code, path } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function tuple(value: unknown, length: number, path: string): Vector3Tuple | ManifestValidationFailure {
  if (!Array.isArray(value) || value.length !== length || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) return fail("part.manifest.invalid-transform", path);
  return value as unknown as Vector3Tuple;
}

function positive(value: unknown, path: string): number | ManifestValidationFailure {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fail("part.manifest.invalid-positive-number", path);
}

function nonNegative(value: unknown, path: string): number | ManifestValidationFailure {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fail("part.manifest.invalid-non-negative-number", path);
}

function stringValue(value: unknown, path: string): string | ManifestValidationFailure {
  return typeof value === "string" && value.trim().length > 0 ? value : fail("part.manifest.invalid-string", path);
}

function stringList(value: unknown, path: string): readonly string[] | ManifestValidationFailure {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) return fail("part.manifest.invalid-string-list", path);
  return Object.freeze(value.slice() as string[]);
}

function configurationSchema(value: unknown, path: string): PartConfigurationSchema | ManifestValidationFailure | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || !isObject(value.fields)) return fail("part.manifest.invalid-configuration-schema", path);
  const fields: Record<string, ConfigurationField> = {};
  for (const [fieldId, rawField] of Object.entries(value.fields)) {
    if (!isObject(rawField) || (rawField.type !== "number" && rawField.type !== "string" && rawField.type !== "boolean")) return fail("part.manifest.invalid-configuration-field", `${path}.fields.${fieldId}`);
    const defaultValue = rawField.default;
    const minValue = rawField.min;
    const maxValue = rawField.max;
    const field: ConfigurationField = {
      type: rawField.type,
      ...(rawField.required === undefined ? {} : { required: rawField.required === true }),
      ...(defaultValue === undefined ? {} : { default: defaultValue as JsonPrimitive }),
      ...(minValue === undefined ? {} : { min: minValue as number }),
      ...(maxValue === undefined ? {} : { max: maxValue as number }),
    };
    if (field.min !== undefined && (!Number.isFinite(field.min) || field.max !== undefined && field.min > field.max)) return fail("part.manifest.invalid-configuration-range", `${path}.fields.${fieldId}`);
    if (field.max !== undefined && !Number.isFinite(field.max)) return fail("part.manifest.invalid-configuration-range", `${path}.fields.${fieldId}`);
    fields[fieldId] = field;
  }
  return { fields };
}

function parseSockets(value: unknown): readonly SocketDefinition[] | ManifestValidationFailure {
  if (!Array.isArray(value) || value.length === 0) return fail("part.manifest.invalid-sockets", "assembly.sockets");
  const values = value as unknown[];
  const ids = new Set<string>();
  const sockets: SocketDefinition[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const path = `assembly.sockets[${String(index)}]`;
    const raw = values[index];
    if (!isObject(raw)) return fail("part.manifest.invalid-socket", path);
    const id = stringValue(raw.id, `${path}.id`);
    const accepts = stringList(raw.accepts, `${path}.accepts`);
    const position = tuple(raw.position, 3, `${path}.position`);
    const rotation = raw.rotation === undefined ? [0, 0, 0] as Vector3Tuple : tuple(raw.rotation, 3, `${path}.rotation`);
    if (id instanceof Object && "error" in id) return id;
    if (accepts instanceof Object && "error" in accepts) return accepts;
    if (position instanceof Object && "error" in position) return position;
    if (rotation instanceof Object && "error" in rotation) return rotation;
    if (ids.has(id)) return fail("part.manifest.duplicate-socket", `${path}.id`);
    ids.add(id);
    sockets.push({ id, accepts, position, rotation, ...(raw.tags === undefined ? {} : { tags: stringList(raw.tags, `${path}.tags`) as readonly string[] }), ...(raw.singleUse === false ? { singleUse: false } : {}) });
  }
  return Object.freeze(sockets);
}

function parseColliders(value: unknown): readonly PartColliderDefinition[] | ManifestValidationFailure {
  if (!Array.isArray(value) || value.length === 0) return fail("part.manifest.invalid-colliders", "physics.colliders");
  const values = value as unknown[];
  const colliders: PartColliderDefinition[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const path = `physics.colliders[${String(index)}]`;
    const raw = values[index];
    if (!isObject(raw) || (raw.shape !== "cuboid" && raw.shape !== "cylinder")) return fail("part.manifest.invalid-collider", path);
    const position = tuple(raw.position, 3, `${path}.position`);
    const rotation = tuple(raw.rotation, 3, `${path}.rotation`);
    const friction = nonNegative(raw.friction, `${path}.friction`);
    const restitution = raw.restitution === undefined ? 0 : nonNegative(raw.restitution, `${path}.restitution`);
    if (position instanceof Object && "error" in position) return position;
    if (rotation instanceof Object && "error" in rotation) return rotation;
    if (friction instanceof Object && "error" in friction) return friction;
    if (restitution instanceof Object && "error" in restitution) return restitution;
    if (restitution > 1) return fail("part.manifest.invalid-restitution", `${path}.restitution`);
    if (raw.shape === "cuboid") {
      const halfExtents = tuple(raw.halfExtents, 3, `${path}.halfExtents`);
      if (halfExtents instanceof Object && "error" in halfExtents) return halfExtents;
      if (halfExtents.some((component) => component <= 0)) return fail("part.manifest.invalid-collider-size", `${path}.halfExtents`);
      colliders.push({ shape: raw.shape, halfExtents, position, rotation, friction, restitution });
    } else {
      const halfHeight = positive(raw.halfHeight, `${path}.halfHeight`);
      const radius = positive(raw.radius, `${path}.radius`);
      if (halfHeight instanceof Object && "error" in halfHeight) return halfHeight;
      if (radius instanceof Object && "error" in radius) return radius;
      colliders.push({ shape: raw.shape, halfHeight, radius, position, rotation, friction, restitution });
    }
  }
  return Object.freeze(colliders);
}

export function parsePartManifest(input: unknown): ParsedManifest {
  if (!isObject(input)) return fail("part.manifest.invalid-document", "$manifest");
  if (input.schemaVersion !== 1 || input.kind !== "core.part") return fail("part.manifest.unsupported-schema", "$manifest.schemaVersion");
  const id = stringValue(input.id, "id");
  const revision = positive(input.revision, "revision");
  if (id instanceof Object && "error" in id) return id;
  if (revision instanceof Object && "error" in revision) return revision;
  if (!isObject(input.assembly) || !isObject(input.physics) || !isObject(input.visual) || !isObject(input.provenance)) return fail("part.manifest.invalid-sections", "$manifest");
  const sockets = parseSockets(input.assembly.sockets);
  const capabilities = stringList(input.assembly.capabilities, "assembly.capabilities");
  const body = input.physics.body;
  const colliders = parseColliders(input.physics.colliders);
  if (sockets instanceof Object && "error" in sockets) return sockets;
  if (capabilities instanceof Object && "error" in capabilities) return capabilities;
  if (!isObject(body)) return fail("part.manifest.invalid-body", "physics.body");
  const mass = positive(body.mass, "physics.body.mass");
  const linearDamping = nonNegative(body.linearDamping, "physics.body.linearDamping");
  const angularDamping = nonNegative(body.angularDamping, "physics.body.angularDamping");
  if (mass instanceof Object && "error" in mass) return mass;
  if (linearDamping instanceof Object && "error" in linearDamping) return linearDamping;
  if (angularDamping instanceof Object && "error" in angularDamping) return angularDamping;
  if (colliders instanceof Object && "error" in colliders) return colliders;
  const actuator = input.physics.actuator;
  let parsedActuator: PartPhysicsDefinition["actuator"];
  if (actuator !== undefined) {
    if (!isObject(actuator) || (actuator.kind !== "wheel" && actuator.kind !== "steering")) return fail("part.manifest.invalid-actuator", "physics.actuator");
    const axis = tuple(actuator.axis, 3, "physics.actuator.axis");
    const maxForce = positive(actuator.maxForce, "physics.actuator.maxForce");
    const targetSpeed = positive(actuator.targetSpeed, "physics.actuator.targetSpeed");
    if (axis instanceof Object && "error" in axis) return axis;
    if (maxForce instanceof Object && "error" in maxForce) return maxForce;
    if (targetSpeed instanceof Object && "error" in targetSpeed) return targetSpeed;
    if (axis.every((component) => component === 0)) return fail("part.manifest.invalid-actuator-axis", "physics.actuator.axis");
    const limitRadians = actuator.limitRadians === undefined ? undefined : nonNegative(actuator.limitRadians, "physics.actuator.limitRadians");
    const stiffness = actuator.stiffness === undefined ? undefined : positive(actuator.stiffness, "physics.actuator.stiffness");
    const damping = actuator.damping === undefined ? undefined : positive(actuator.damping, "physics.actuator.damping");
    if (limitRadians !== undefined && limitRadians instanceof Object && "error" in limitRadians) return limitRadians;
    if (stiffness !== undefined && stiffness instanceof Object && "error" in stiffness) return stiffness;
    if (damping !== undefined && damping instanceof Object && "error" in damping) return damping;
    parsedActuator = { kind: actuator.kind, axis, maxForce, targetSpeed, ...(limitRadians === undefined ? {} : { limitRadians }), ...(stiffness === undefined ? {} : { stiffness }), ...(damping === undefined ? {} : { damping }) };
  }
  const factory = stringValue(input.visual.factory, "visual.factory");
  const visualRevision = positive(input.visual.revision, "visual.revision");
  const sourceCommit = stringValue(input.visual.sourceCommit, "visual.sourceCommit");
  const source = input.visual.source === "img2threejs" || input.visual.source === "procedural-brief" ? input.visual.source : undefined;
  const normalization = input.visual.normalization;
  if (factory instanceof Object && "error" in factory) return factory;
  if (visualRevision instanceof Object && "error" in visualRevision) return visualRevision;
  if (sourceCommit instanceof Object && "error" in sourceCommit) return sourceCommit;
  if (source === undefined || !isObject(normalization) || normalization.metersPerUnit !== 1 || normalization.upAxis !== "y" || normalization.forwardAxis !== "z" || normalization.origin !== "part-frame") return fail("part.manifest.invalid-normalization", "visual.normalization");
  if (!Array.isArray(input.visual.variants) || input.visual.variants.length < 2) return fail("part.manifest.variants-required", "visual.variants");
  const rawVariants = input.visual.variants as unknown[];
  const variants: PartVisualVariant[] = [];
  const variantIds = new Set<string>();
  for (let index = 0; index < rawVariants.length; index += 1) {
    const path = `visual.variants[${String(index)}]`;
    const raw = rawVariants[index];
    if (!isObject(raw)) return fail("part.manifest.invalid-variant", path);
    const variantId = stringValue(raw.id, `${path}.id`);
    const label = stringValue(raw.label, `${path}.label`);
    const variantFactory = stringValue(raw.factory, `${path}.factory`);
    if (variantId instanceof Object && "error" in variantId) return variantId;
    if (label instanceof Object && "error" in label) return label;
    if (variantFactory instanceof Object && "error" in variantFactory) return variantFactory;
    if (variantIds.has(variantId)) return fail("part.manifest.duplicate-variant", `${path}.id`);
    variantIds.add(variantId);
    variants.push({ id: variantId, label, factory: variantFactory });
  }
  const brief = stringValue(input.provenance.brief, "provenance.brief");
  const license = stringValue(input.provenance.license, "provenance.license");
  const toolCommit = stringValue(input.provenance.toolCommit, "provenance.toolCommit");
  if (brief instanceof Object && "error" in brief) return brief;
  if (license instanceof Object && "error" in license) return license;
  if (toolCommit instanceof Object && "error" in toolCommit) return toolCommit;
  const schema = configurationSchema(input.assembly.configurationSchema, "assembly.configurationSchema");
  if (schema !== undefined && schema instanceof Object && "error" in schema) return schema;
  const reference = input.provenance.reference;
  if (reference !== undefined && typeof reference !== "string") return fail("part.manifest.invalid-reference", "provenance.reference");
  const manifest: PartManifest = {
    schemaVersion: 1,
    kind: "core.part",
    id,
    revision,
    assembly: { sockets, capabilities, ...(input.assembly.allowSelfConnection === true ? { allowSelfConnection: true } : {}), ...(schema === undefined ? {} : { configurationSchema: schema }) },
    physics: { body: { mass, linearDamping, angularDamping }, colliders, ...(parsedActuator === undefined ? {} : { actuator: parsedActuator }) },
    visual: { factory, revision: visualRevision, source, sourceCommit, normalization: { metersPerUnit: 1, upAxis: "y", forwardAxis: "z", origin: "part-frame" }, variants },
    provenance: { brief, license, ...(reference === undefined ? {} : { reference }), toolCommit },
  };
  return { ok: true, value: Object.freeze(manifest) };
}

export function projectPartDefinition(manifest: PartManifest): PartDefinition {
  return {
    id: manifest.id,
    version: manifest.revision,
    sockets: manifest.assembly.sockets,
    capabilities: manifest.assembly.capabilities,
    ...(manifest.assembly.allowSelfConnection === true ? { allowSelfConnection: true } : {}),
    ...(manifest.assembly.configurationSchema === undefined ? {} : { configurationSchema: manifest.assembly.configurationSchema }),
  };
}

export function cloneManifestValue(manifest: PartManifest): JsonValue {
  return JSON.parse(JSON.stringify(manifest)) as JsonValue;
}
