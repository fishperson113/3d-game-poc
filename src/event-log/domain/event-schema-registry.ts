import type { EventEnvelope } from "../../kernel/events/contracts";
import { eventError, type EventInfrastructureError } from "../../kernel/events/event-errors";
import { snapshotEventEnvelope, snapshotJsonValue } from "../../kernel/events/json-snapshot";
import type { EventDescriptor } from "./event-descriptor";

export interface EventUpcaster {
  readonly type: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  upcast(payload: unknown): unknown;
}

export interface EventProjection {
  readonly type: string;
  readonly payload: unknown;
  readonly sourceVersion: number;
  readonly version: number;
  readonly known: boolean;
  readonly descriptor?: EventDescriptor<unknown>;
  readonly migrationChain: readonly number[];
}

export class EventSchemaRegistry {
  private readonly descriptors = new Map<string, EventDescriptor<unknown>>();
  private readonly upcasters = new Map<string, EventUpcaster>();

  public register<TPayload>(descriptor: EventDescriptor<TPayload>): void {
    if (!isValidVersion(descriptor.version) || !isNonEmpty(descriptor.type) || typeof descriptor.parsePayload !== "function" || typeof descriptor.summarize !== "function" || descriptor.redact !== undefined && typeof descriptor.redact !== "function") {
      throw new Error("event.schema.invalid: descriptor metadata or methods are invalid");
    }
    const key = this.key(descriptor.type, descriptor.version);
    if (this.descriptors.has(key)) throw new Error(`event.schema.duplicate: ${descriptor.type}@${String(descriptor.version)}`);
    this.descriptors.set(key, descriptor);
  }

  public registerUpcaster(upcaster: EventUpcaster): void;
  public registerUpcaster(type: string, fromVersion: number, toVersion: number, upcast: (payload: unknown) => unknown): void;
  public registerUpcaster(upcasterOrType: EventUpcaster | string, fromVersion?: number, toVersion?: number, upcast?: (payload: unknown) => unknown): void {
    const upcaster: EventUpcaster = typeof upcasterOrType === "string"
      ? { type: upcasterOrType, fromVersion: fromVersion as number, toVersion: toVersion as number, upcast: upcast as (payload: unknown) => unknown }
      : upcasterOrType;
    if (!isValidVersion(upcaster.fromVersion) || !isValidVersion(upcaster.toVersion) || upcaster.toVersion !== upcaster.fromVersion + 1 || !isNonEmpty(upcaster.type) || typeof upcaster.upcast !== "function") {
      throw new Error("event.schema.invalid: upcasters must move one version forward");
    }
    const key = this.key(upcaster.type, upcaster.fromVersion);
    if (this.upcasters.has(key)) throw new Error(`event.schema.duplicate: upcaster ${upcaster.type}@${String(upcaster.fromVersion)}`);
    this.upcasters.set(key, upcaster);
  }

  public resolve(type: string, version: number): EventDescriptor<unknown> | undefined {
    return this.descriptors.get(this.key(type, version));
  }

  public currentVersion(type: string): number | undefined {
    let current: number | undefined;
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.type === type && (current === undefined || descriptor.version > current)) current = descriptor.version;
    }
    return current;
  }

  public getCurrentVersion(type: string): number | undefined {
    return this.currentVersion(type);
  }

  public project(event: EventEnvelope): { ok: true; value: EventProjection } | { ok: false; error: EventInfrastructureError } {
    const sourceEvent = snapshotEventEnvelope(event);
    if (!sourceEvent.ok) return sourceEvent;
    const sourcePayload = snapshotJsonValue(sourceEvent.value.payload, "$event.payload");
    if (!sourcePayload.ok) return { ok: false, error: eventError("event.schema.invalid-payload", sourcePayload.error.message, sourcePayload.error.path) };
    const sourceDescriptor = this.resolve(sourceEvent.value.type, sourceEvent.value.eventVersion);
    if (sourceDescriptor === undefined) {
      return { ok: true, value: { type: sourceEvent.value.type, payload: sourcePayload.value, sourceVersion: sourceEvent.value.eventVersion, version: sourceEvent.value.eventVersion, known: false, migrationChain: [] } };
    }
    let payload: unknown;
    try {
      payload = sourceDescriptor.parsePayload(sourcePayload.value);
    } catch {
      return { ok: false, error: eventError("event.schema.invalid-payload", "Descriptor rejected event payload.", "$event.payload") };
    }
    const parsed = snapshotJsonValue(payload, "$event.payload");
    if (!parsed.ok) return { ok: false, error: eventError("event.schema.invalid-payload", parsed.error.message, parsed.error.path) };
    let version = sourceEvent.value.eventVersion;
    const chain: number[] = [];
    const targetVersion = this.currentVersion(sourceEvent.value.type) ?? version;
    let currentPayload = parsed.value;
    while (version < targetVersion) {
      const upcaster = this.upcasters.get(this.key(sourceEvent.value.type, version));
      if (upcaster === undefined) {
        return { ok: false, error: eventError("event.upcast.failed", `No upcaster from version ${String(version)} to ${String(version + 1)}.`, "$event.eventVersion") };
      }
      try {
        payload = upcaster.upcast(currentPayload);
      } catch {
        return { ok: false, error: eventError("event.upcast.failed", `Upcaster failed at version ${String(version)}.`, "$event.payload") };
      }
      const migrated = snapshotJsonValue(payload, "$event.payload");
      if (!migrated.ok) return { ok: false, error: eventError("event.upcast.failed", migrated.error.message, migrated.error.path) };
      version = upcaster.toVersion;
      chain.push(version);
      const targetDescriptor = this.resolve(sourceEvent.value.type, version);
      if (targetDescriptor === undefined) {
        return { ok: false, error: eventError("event.upcast.failed", `No descriptor is registered for version ${String(version)}.`, "$event.eventVersion") };
      }
      let validatedPayload: unknown;
      try {
        validatedPayload = targetDescriptor.parsePayload(migrated.value);
      } catch {
        return { ok: false, error: eventError("event.schema.invalid-payload", `Migrated payload is invalid at version ${String(version)}.`, "$event.payload") };
      }
      const validated = snapshotJsonValue(validatedPayload, "$event.payload");
      if (!validated.ok) return { ok: false, error: eventError("event.schema.invalid-payload", validated.error.message, validated.error.path) };
      payload = validated.value;
      currentPayload = validated.value;
    }
    return {
      ok: true,
      value: {
        type: sourceEvent.value.type,
        payload,
        sourceVersion: sourceEvent.value.eventVersion,
        version,
        known: true,
        descriptor: this.resolve(sourceEvent.value.type, version) ?? sourceDescriptor,
        migrationChain: Object.freeze(chain.slice()),
      },
    };
  }

  public upcast(event: EventEnvelope): { ok: true; value: EventProjection } | { ok: false; error: EventInfrastructureError } {
    return this.project(event);
  }

  private key(type: string, version: number): string {
    return `${type}\u0000${String(version)}`;
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
