import type { Vector3Tuple } from "../../kernel/math";
import type { JsonPrimitive, JsonValue } from "../../kernel/json";

export type ConfigurationFieldType = "number" | "string" | "boolean";

export interface ConfigurationField {
  readonly type: ConfigurationFieldType;
  readonly required?: boolean;
  readonly default?: JsonPrimitive;
  readonly min?: number;
  readonly max?: number;
}

export interface PartConfigurationSchema {
  readonly fields: Readonly<Record<string, ConfigurationField>>;
}

export type ConfigurationValidation =
  | { readonly ok: true; readonly value?: Readonly<Record<string, JsonValue>> }
  | { readonly ok: false; readonly code: "building.part.configuration-invalid"; readonly field?: string };

export interface SocketDefinition {
  readonly id: string;
  readonly accepts: readonly string[];
  readonly position: Vector3Tuple;
  readonly rotation?: Vector3Tuple;
  readonly tags?: readonly string[];
  readonly singleUse?: boolean;
}

export interface PartDefinition {
  readonly id: string;
  readonly version: number;
  readonly sockets: readonly SocketDefinition[];
  readonly capabilities: readonly string[];
  readonly allowSelfConnection?: boolean;
  readonly configurationSchema?: PartConfigurationSchema;
}

export function normalizePartConfiguration(definition: PartDefinition, input: Readonly<Record<string, JsonValue>> | undefined): ConfigurationValidation {
  const schema = definition.configurationSchema;
  if (schema === undefined) return input === undefined ? { ok: true } : { ok: true, value: input };
  const source = input ?? {};
  const result: Record<string, JsonValue> = {};
  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const supplied = Object.hasOwn(source, fieldId) ? source[fieldId] : undefined;
    const value = supplied === undefined ? field.default : supplied;
    if (value === undefined) {
      if (field.required === true) return { ok: false, code: "building.part.configuration-invalid", field: fieldId };
      continue;
    }
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return { ok: false, code: "building.part.configuration-invalid", field: fieldId };
    if (field.type === "string" && typeof value !== "string") return { ok: false, code: "building.part.configuration-invalid", field: fieldId };
    if (field.type === "boolean" && typeof value !== "boolean") return { ok: false, code: "building.part.configuration-invalid", field: fieldId };
    if (typeof value === "number" && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) return { ok: false, code: "building.part.configuration-invalid", field: fieldId };
    result[fieldId] = value;
  }
  const unknown = Object.keys(source).find((key) => !Object.hasOwn(schema.fields, key));
  if (unknown !== undefined) return { ok: false, code: "building.part.configuration-invalid", field: unknown };
  return Object.keys(result).length === 0 ? { ok: true } : { ok: true, value: result };
}
