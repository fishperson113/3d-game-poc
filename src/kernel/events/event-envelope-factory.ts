import type { JsonValue } from "../json";
import type { Result } from "../result";
import type { EventEnvelope } from "./contracts";
import { eventError, type EventInfrastructureError } from "./event-errors";
import { snapshotEventEnvelope, snapshotJsonValue } from "./json-snapshot";

export interface EventSequenceSource {
  next(): number;
  current(): number;
}

export function createEventSequenceSource(start = 0): EventSequenceSource {
  if (!Number.isSafeInteger(start) || start < 0) throw new Error("Event sequence start must be a non-negative safe integer.");
  let current = start;
  return {
    next: () => {
      if (current >= Number.MAX_SAFE_INTEGER) throw new Error("Event sequence exhausted.");
      current += 1;
      return current;
    },
    current: () => current,
  };
}

export interface EventEnvelopeInput<TPayload extends JsonValue = JsonValue> {
  readonly type: string;
  readonly eventVersion: number;
  readonly payload: TPayload;
  readonly producer?: string;
  readonly correlationId: string;
  readonly severity?: EventEnvelope["severity"];
  readonly occurredAt?: string;
  readonly observedAt?: string;
  readonly causationId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly context?: Readonly<Record<string, JsonValue>>;
  readonly tags?: readonly string[];
}

export interface EventEnvelopeFactoryOptions {
  readonly id?: () => string;
  readonly now?: () => string;
  readonly sequence?: EventSequenceSource | (() => number);
  readonly producer?: string;
}

export interface DerivedEventInput<TPayload extends JsonValue = JsonValue> {
  readonly type: string;
  readonly eventVersion: number;
  readonly payload: TPayload;
  readonly severity?: EventEnvelope["severity"];
  readonly context?: Readonly<Record<string, JsonValue>>;
  readonly tags?: readonly string[];
}

function defaultId(): string {
  const runtime = globalThis as unknown as { readonly crypto?: { randomUUID(): string } };
  if (runtime.crypto === undefined) throw new Error("A crypto.randomUUID implementation is required to create event IDs.");
  return runtime.crypto.randomUUID();
}

function defaultNow(): string {
  return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export class EventEnvelopeFactory {
  private readonly id: () => string;
  private readonly now: () => string;
  private readonly sequence: EventSequenceSource;
  private readonly producer: string;

  public constructor(options: EventEnvelopeFactoryOptions = {}) {
    this.id = options.id ?? defaultId;
    this.now = options.now ?? defaultNow;
    this.sequence = typeof options.sequence === "function"
      ? { next: options.sequence, current: () => 0 }
      : options.sequence ?? createEventSequenceSource();
    this.producer = options.producer ?? "event.infrastructure";
  }

  public create<TPayload extends JsonValue>(input: EventEnvelopeInput<TPayload> | null | undefined): Result<EventEnvelope<string, TPayload>, EventInfrastructureError> {
    try {
      const inputProperties = readFactoryInput(input);
      if (!inputProperties.ok) return inputProperties;
      const values = inputProperties.value;
      const type = values.get("type");
      const eventVersion = values.get("eventVersion");
      const correlationId = values.get("correlationId");
      const producer = values.get("producer") ?? this.producer;
      if (!isNonEmptyString(type)) return { ok: false, error: eventError("event.envelope.invalid", "type must be a non-empty string.", "$event.type") };
      if (!Number.isSafeInteger(eventVersion) || (eventVersion as number) < 1) return { ok: false, error: eventError("event.envelope.invalid", "eventVersion must be a positive safe integer.", "$event.eventVersion") };
      if (!isNonEmptyString(producer)) return { ok: false, error: eventError("event.envelope.invalid", "producer must be a non-empty string.", "$event.producer") };
      if (!isNonEmptyString(correlationId)) return { ok: false, error: eventError("event.envelope.invalid", "correlationId must be a non-empty string.", "$event.correlationId") };
      const severity = values.get("severity") ?? "info";
      if (!isSeverity(severity)) return { ok: false, error: eventError("event.envelope.invalid", "severity must be a primitive event severity.", "$event.severity") };

      const occurredAt = resolveTimestamp(values.get("occurredAt"), this.now, "$event.occurredAt");
      if (!occurredAt.ok) return occurredAt;
      const observedAt = resolveTimestamp(values.get("observedAt"), this.now, "$event.observedAt");
      if (!observedAt.ok) return observedAt;

      let id: unknown;
      try {
        id = this.id();
      } catch {
        return { ok: false, error: eventError("event.id.invalid", "Event ID generator failed.", "$event.id") };
      }
      if (!isNonEmptyString(id)) return { ok: false, error: eventError("event.id.invalid", "Event ID generator must return a non-empty string.", "$event.id") };

      let sequence: unknown;
      try {
        sequence = this.sequence.next();
      } catch {
        return { ok: false, error: eventError("event.sequence.invalid", "Event sequence source failed.", "$event.sequence") };
      }
      if (!Number.isSafeInteger(sequence) || (sequence as number) < 1) return { ok: false, error: eventError("event.sequence.invalid", "Event sequence must be a positive safe integer.", "$event.sequence") };

      const causationId = values.get("causationId");
      const traceId = values.get("traceId");
      const spanId = values.get("spanId");
      const tags = values.get("tags");
      const candidate: EventEnvelope = {
        id,
        type,
        eventVersion: eventVersion as number,
        occurredAt: occurredAt.value,
        observedAt: observedAt.value,
        sequence: sequence as number,
        severity,
        producer,
        correlationId,
        ...(causationId === undefined ? {} : { causationId: causationId as string }),
        ...(traceId === undefined ? {} : { traceId: traceId as string }),
        ...(spanId === undefined ? {} : { spanId: spanId as string }),
        context: (values.get("context") ?? {}) as Readonly<Record<string, JsonValue>>,
        ...(tags === undefined ? {} : { tags: tags as readonly string[] }),
        payload: values.get("payload") as TPayload,
      };
      const snapshot = snapshotEventEnvelope(candidate);
      return snapshot.ok ? { ok: true, value: snapshot.value as EventEnvelope<string, TPayload> } : snapshot;
    } catch {
      return { ok: false, error: eventError("event.envelope.invalid", "Event input could not be inspected safely.", "$event") };
    }
  }

  public startCorrelation(): string {
    return this.id();
  }

  public derive<TPayload extends JsonValue>(parent: EventEnvelope, input: DerivedEventInput<TPayload>): Result<EventEnvelope<string, TPayload>, EventInfrastructureError> {
    const parentSnapshot = snapshotEventEnvelope(parent);
    if (!parentSnapshot.ok) return parentSnapshot;
    const inputProperties = readFactoryInput(input);
    if (!inputProperties.ok) return inputProperties;
    const values = inputProperties.value;
    const derived: Record<string, unknown> = {
      type: values.get("type"),
      eventVersion: values.get("eventVersion"),
      payload: values.get("payload"),
      producer: this.producer,
      correlationId: parentSnapshot.value.correlationId,
      causationId: parentSnapshot.value.id,
      ...(parentSnapshot.value.traceId === undefined ? {} : { traceId: parentSnapshot.value.traceId }),
      ...(parentSnapshot.value.spanId === undefined ? {} : { spanId: parentSnapshot.value.spanId }),
      ...(values.get("severity") === undefined ? {} : { severity: values.get("severity") }),
      ...(values.get("context") === undefined ? {} : { context: values.get("context") }),
      ...(values.get("tags") === undefined ? {} : { tags: values.get("tags") }),
    };
    return this.create(derived as unknown as EventEnvelopeInput<TPayload>);
  }

  public snapshot(event: unknown): Result<EventEnvelope, EventInfrastructureError> {
    return snapshotEventEnvelope(event);
  }

  public snapshotPayload(value: unknown): Result<JsonValue, EventInfrastructureError> {
    return snapshotJsonValue(value);
  }
}

export function createEventEnvelope<TPayload extends JsonValue>(input: EventEnvelopeInput<TPayload>, options: EventEnvelopeFactoryOptions = {}): Result<EventEnvelope<string, TPayload>, EventInfrastructureError> {
  return new EventEnvelopeFactory(options).create(input);
}

function readFactoryInput(input: unknown): Result<ReadonlyMap<string, unknown>, EventInfrastructureError> {
  if (input === null || typeof input !== "object") return { ok: false, error: eventError("event.envelope.invalid", "Event input must be an object.", "$event") };
  try {
    if (Object.getOwnPropertySymbols(input).length > 0) return { ok: false, error: eventError("event.envelope.invalid", "Event input cannot contain symbol-keyed properties.", "$event") };
    const values = new Map<string, unknown>();
    for (const key of Object.getOwnPropertyNames(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false, error: eventError("event.envelope.invalid", "Event input properties must be enumerable data properties.", `$event.${key}`) };
      }
      values.set(key, descriptor.value);
    }
    return { ok: true, value: values };
  } catch {
    return { ok: false, error: eventError("event.envelope.invalid", "Event input could not be inspected safely.", "$event") };
  }
}

function resolveTimestamp(value: unknown, now: () => string, path: string): Result<string, EventInfrastructureError> {
  if (value !== undefined) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
      ? { ok: true, value }
      : { ok: false, error: eventError("event.envelope.invalid", "Timestamp must be an ISO date string.", path) };
  }
  let generated: unknown;
  try {
    generated = now();
  } catch {
    return { ok: false, error: eventError("event.clock.invalid", "Event clock failed.", path) };
  }
  return typeof generated === "string" && !Number.isNaN(Date.parse(generated))
    ? { ok: true, value: generated }
    : { ok: false, error: eventError("event.clock.invalid", "Event clock must return an ISO date string.", path) };
}

function isSeverity(value: unknown): value is EventEnvelope["severity"] {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}
