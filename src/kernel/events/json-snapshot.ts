import type { JsonValue } from "../json";
import type { Result } from "../result";
import { eventError, type EventInfrastructureError } from "./event-errors";
import type { EventEnvelope } from "./contracts";

type MutableJson = string | number | boolean | null | MutableJson[] | { [key: string]: MutableJson };
type CopyResult = { readonly ok: true; readonly value: MutableJson } | { readonly ok: false; readonly error: EventInfrastructureError };

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: object | null = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function pathForKey(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function copyJson(value: unknown, path: string, ancestors: readonly object[]): CopyResult {
  if (value === null) return { ok: true, value: null };
  if (typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, error: eventError("event.payload.not-json-safe", "JSON numbers must be finite.", path) };
  }
  if (typeof value !== "object") {
    return { ok: false, error: eventError("event.payload.not-json-safe", `Unsupported JSON value type: ${typeof value}.`, path) };
  }
  if (ancestors.includes(value)) {
    return { ok: false, error: eventError("event.payload.not-json-safe", "Cyclic references are not JSON-safe.", path) };
  }
  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0 || Object.getOwnPropertyNames(value).some((key) => key !== "length" && !isArrayIndexKey(key, value.length))) {
      return { ok: false, error: eventError("event.payload.not-json-safe", "Arrays may only contain indexed JSON values.", path) };
    }
    const result: MutableJson[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) {
        return { ok: false, error: eventError("event.payload.not-json-safe", "Sparse arrays are not JSON-safe.", `${path}[${String(index)}]`) };
      }
      if (!("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false, error: eventError("event.payload.not-json-safe", "Accessor properties are not JSON-safe.", `${path}[${String(index)}]`) };
      }
      const copied = copyJson(descriptor.value, `${path}[${String(index)}]`, [...ancestors, value]);
      if (!copied.ok) return copied;
      result.push(copied.value);
    }
    return { ok: true, value: result };
  }
  if (!isPlainObject(value)) {
    return { ok: false, error: eventError("event.payload.not-json-safe", "Only plain objects are JSON-safe.", path) };
  }
  // Use a null-prototype object while copying so a JSON key named `__proto__`
  // remains data instead of invoking Object.prototype's legacy setter.
  const result: Record<string, MutableJson> = Object.create(null) as Record<string, MutableJson>;
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return { ok: false, error: eventError("event.payload.not-json-safe", "Symbol-keyed properties are not JSON-safe.", path) };
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && !descriptor.enumerable) {
      return { ok: false, error: eventError("event.payload.not-json-safe", "Non-enumerable properties are not JSON-safe.", pathForKey(path, key)) };
    }
  }
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      return { ok: false, error: eventError("event.payload.not-json-safe", "Accessor properties are not JSON-safe.", pathForKey(path, key)) };
    }
    const copied = copyJson(descriptor.value, pathForKey(path, key), [...ancestors, value]);
    if (!copied.ok) return copied;
    result[key] = copied.value;
  }
  return { ok: true, value: result };
}

function isArrayIndexKey(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function freezeJson(value: MutableJson): JsonValue {
  if (Array.isArray(value)) {
    for (const item of value) freezeJson(item);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) freezeJson(item);
  }
  return Object.freeze(value) as JsonValue;
}

export function snapshotJsonValue(value: unknown, path = "$payload"): Result<JsonValue, EventInfrastructureError> {
  try {
    const copied = copyJson(value, path, []);
    return copied.ok ? { ok: true, value: freezeJson(copied.value) } : copied;
  } catch {
    return { ok: false, error: eventError("event.payload.not-json-safe", "An object could not be inspected safely.", path) };
  }
}

export function snapshotEventEnvelope(event: unknown): Result<EventEnvelope, EventInfrastructureError> {
  try {
    if (event === null || typeof event !== "object") {
      return { ok: false, error: eventError("event.envelope.invalid", "Event envelope must be an object.", "$event") };
    }
    const input = event as Record<string, unknown>;
    const values = new Map<string, unknown>();
    const read = (key: string): Result<unknown, EventInfrastructureError> => {
      if (values.has(key)) return { ok: true, value: values.get(key) };
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined) {
        return { ok: false, error: eventError("event.envelope.invalid", `${key} must be provided as an own property.`, `$event.${key}`) };
      }
      if (!("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false, error: eventError("event.envelope.invalid", `${key} must be a data property; accessors are not accepted.`, `$event.${key}`) };
      }
      values.set(key, descriptor.value);
      return { ok: true, value: descriptor.value };
    };
    const requiredStrings = ["id", "type", "occurredAt", "observedAt", "producer", "correlationId"] as const;
    for (const key of requiredStrings) {
      const property = read(key);
      if (!property.ok || typeof property.value !== "string" || property.value.length === 0) {
        return { ok: false, error: eventError("event.envelope.invalid", `${key} must be a non-empty string.`, `$event.${key}`) };
      }
    }
    const eventVersion = read("eventVersion");
    if (!eventVersion.ok || !Number.isSafeInteger(eventVersion.value) || (eventVersion.value as number) < 1) {
      return { ok: false, error: eventError("event.envelope.invalid", "eventVersion must be a positive safe integer.", "$event.eventVersion") };
    }
    const sequence = read("sequence");
    if (!sequence.ok || !Number.isSafeInteger(sequence.value) || (sequence.value as number) < 1) {
      return { ok: false, error: eventError("event.sequence.invalid", "sequence must be a positive safe integer.", "$event.sequence") };
    }
    const severity = read("severity");
    if (!severity.ok || !isSeverity(severity.value)) {
      return { ok: false, error: eventError("event.envelope.invalid", "severity is invalid.", "$event.severity") };
    }
    for (const key of ["occurredAt", "observedAt"] as const) {
      const property = read(key);
      if (!property.ok || typeof property.value !== "string" || Number.isNaN(Date.parse(property.value))) {
        return { ok: false, error: eventError("event.envelope.invalid", `${key} must be an ISO date string.`, `$event.${key}`) };
      }
    }
    for (const key of ["causationId", "traceId", "spanId"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor !== undefined && (!("value" in descriptor) || !descriptor.enumerable || (descriptor.value !== undefined && (typeof descriptor.value !== "string" || descriptor.value.length === 0)))) {
        return { ok: false, error: eventError("event.envelope.invalid", `${key} must be a non-empty string when provided.`, `$event.${key}`) };
      }
      if (descriptor !== undefined && "value" in descriptor) values.set(key, descriptor.value);
    }
    const contextInput = read("context");
    if (!contextInput.ok) return contextInput;
    const context = snapshotJsonValue(contextInput.value, "$event.context");
    if (!context.ok || context.value === null || Array.isArray(context.value) || typeof context.value !== "object") {
      return context.ok
        ? { ok: false, error: eventError("event.envelope.invalid", "context must be a JSON object.", "$event.context") }
        : context;
    }
    const tagsInput = Object.getOwnPropertyDescriptor(input, "tags");
    if (tagsInput !== undefined && (!("value" in tagsInput) || !tagsInput.enumerable)) {
      return { ok: false, error: eventError("event.envelope.invalid", "tags must be a data property; accessors are not accepted.", "$event.tags") };
    }
    const tags = tagsInput === undefined || tagsInput.value === undefined ? { ok: true as const, value: undefined } : snapshotJsonValue(tagsInput.value, "$event.tags");
    if (!tags.ok) return tags;
    if (tags.value !== undefined && (!Array.isArray(tags.value) || tags.value.some((tag) => typeof tag !== "string"))) {
      return { ok: false, error: eventError("event.envelope.invalid", "tags must be an array of strings.", "$event.tags") };
    }
    const payloadInput = read("payload");
    if (!payloadInput.ok) return payloadInput;
    const payload = snapshotJsonValue(payloadInput.value, "$event.payload");
    if (!payload.ok) return payload;
    const copied: EventEnvelope = {
      id: values.get("id") as string,
      type: values.get("type") as string,
      eventVersion: eventVersion.value as number,
      occurredAt: values.get("occurredAt") as string,
      observedAt: values.get("observedAt") as string,
      sequence: sequence.value as number,
      severity: severity.value,
      producer: values.get("producer") as string,
      correlationId: values.get("correlationId") as string,
      ...(values.get("causationId") === undefined ? {} : { causationId: values.get("causationId") as string }),
      ...(values.get("traceId") === undefined ? {} : { traceId: values.get("traceId") as string }),
      ...(values.get("spanId") === undefined ? {} : { spanId: values.get("spanId") as string }),
      context: context.value,
      ...(tags.value === undefined ? {} : { tags: tags.value as readonly string[] }),
      payload: payload.value,
    };
    return { ok: true, value: Object.freeze(copied) };
  } catch {
    return { ok: false, error: eventError("event.envelope.invalid", "Event envelope could not be inspected safely.", "$event") };
  }
}

function isSeverity(value: unknown): value is EventEnvelope["severity"] {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

export type { EventInfrastructureError } from "./event-errors";
