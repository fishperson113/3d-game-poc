import type { EventEnvelope } from "../../kernel/events/contracts";
import { snapshotEventEnvelope } from "../../kernel/events/json-snapshot";
import { eventError } from "../../kernel/events/event-errors";
import type { EventLogSink } from "../../event-log/ports/event-log-sink";
import { filterEvents, type EventLogFilter, type EventLogQueryResult, type EventLogQuerySource, type EventLogRetentionMetadata } from "../../event-log/domain/event-log-query";
import type { EventInfrastructureError } from "../../kernel/events/event-errors";

export interface MemoryEventLogSinkOptions {
  readonly capacity?: number;
  readonly excludedTags?: readonly string[];
  readonly shouldRetain?: (event: EventEnvelope) => boolean;
  readonly onDiagnostic?: (error: EventInfrastructureError) => void;
}

export class MemoryEventLogSink implements EventLogSink, EventLogQuerySource {
  private readonly capacity: number;
  private readonly excludedTags: ReadonlySet<string>;
  private readonly shouldRetain: ((event: EventEnvelope) => boolean) | undefined;
  private readonly onDiagnostic: (error: EventInfrastructureError) => void;
  private readonly buffer: Array<EventEnvelope | undefined>;
  private head = 0;
  private size = 0;
  private evictedCount = 0;
  private readonly listeners = new Set<() => void>();

  public constructor(options: MemoryEventLogSinkOptions | number = {}) {
    const config = typeof options === "number" ? { capacity: options } : options;
    this.capacity = config.capacity ?? 1000;
    if (!Number.isSafeInteger(this.capacity) || this.capacity < 1) throw new Error("Memory event log capacity must be a positive safe integer.");
    this.excludedTags = new Set(config.excludedTags ?? ["physics.raw", "physics.contact.raw"]);
    this.shouldRetain = config.shouldRetain;
    this.onDiagnostic = config.onDiagnostic ?? (() => undefined);
    this.buffer = new Array<EventEnvelope | undefined>(this.capacity);
  }

  public write(event: EventEnvelope): void {
    const snapshot = snapshotEventEnvelope(event);
    if (!snapshot.ok) {
      try {
        this.onDiagnostic(snapshot.error);
      } catch {
        // Diagnostics are best effort and cannot break the sink boundary.
      }
      return;
    }
    if ((snapshot.value.tags ?? []).some((tag) => this.excludedTags.has(tag))) return;
    if (this.shouldRetain !== undefined) {
      try {
        if (!this.shouldRetain(snapshot.value)) return;
      } catch {
        try {
          this.onDiagnostic(eventError("event.sink.failed", "Event retention policy failed."));
        } catch {
          // Diagnostics are best effort and cannot break the sink boundary.
        }
        return;
      }
    }
    const index = (this.head + this.size) % this.capacity;
    if (this.size === this.capacity) {
      this.buffer[this.head] = snapshot.value;
      this.head = (this.head + 1) % this.capacity;
      this.evictedCount += 1;
    } else {
      this.buffer[index] = snapshot.value;
      this.size += 1;
    }
    this.notify();
  }

  public snapshot(): readonly EventEnvelope[] {
    const values: EventEnvelope[] = [];
    for (let offset = 0; offset < this.size; offset += 1) {
      const event = this.buffer[(this.head + offset) % this.capacity];
      if (event !== undefined) values.push(event);
    }
    return Object.freeze(values);
  }

  public getEvents(): readonly EventEnvelope[] {
    return this.snapshot();
  }

  public getRetentionMetadata(): EventLogRetentionMetadata {
    const events = this.snapshot();
    const first = events[0];
    const last = events[events.length - 1];
    return {
      capacity: this.capacity,
      retainedCount: this.size,
      evictedCount: this.evictedCount,
      ...(first === undefined ? {} : { oldestSequence: first.sequence }),
      ...(last === undefined ? {} : { newestSequence: last.sequence }),
    };
  }

  public query(filter: EventLogFilter = {}): EventLogQueryResult {
    const events = this.snapshot();
    const result = filterEvents(events, filter);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    const first = events[0];
    return {
      ...result.value,
      evictedCount: this.evictedCount,
      ...(this.evictedCount > 0 && first !== undefined ? { historyCutBeforeSequence: first.sequence } : {}),
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.size = 0;
    this.evictedCount = 0;
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A viewer listener cannot break event retention.
      }
    }
  }
}
