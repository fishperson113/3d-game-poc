import type { EventEnvelope } from "../../kernel/events/contracts";
import { snapshotEventEnvelope, snapshotJsonValue } from "../../kernel/events/json-snapshot";
import { eventError } from "../../kernel/events/event-errors";
import { EventDiagnosticReporter, type DiagnosticRecord } from "../../kernel/events/diagnostic-reporter";
import type { EventEnvelopeFactory } from "../../kernel/events/event-envelope-factory";
import type { EventLogSink } from "../ports/event-log-sink";
import { EventSchemaRegistry } from "../domain/event-schema-registry";
import type { EventLogFilter, EventLogQueryResult, EventLogQuerySource, EventLogRetentionMetadata } from "../domain/event-log-query";
import { exportEventLogSnapshot } from "./event-log-export";

export type EventLogDiagnostic = DiagnosticRecord;

export interface EventLogServiceOptions {
  readonly registry?: EventSchemaRegistry;
  readonly querySource?: EventLogQuerySource;
  readonly onDiagnostic?: (diagnostic: EventLogDiagnostic) => void;
  readonly diagnosticReporter?: EventDiagnosticReporter;
  readonly diagnosticFactory?: EventEnvelopeFactory;
  readonly publishDiagnostic?: (event: EventEnvelope) => void;
  readonly maxSuppressedDiagnostics?: number;
  readonly now?: () => string;
}

export class EventLogService {
  private readonly registry: EventSchemaRegistry;
  private readonly querySource: EventLogQuerySource | undefined;
  private readonly diagnosticReporter: EventDiagnosticReporter;
  private readonly now: () => string;

  public constructor(private readonly sinks: readonly EventLogSink[], options: EventLogServiceOptions | EventSchemaRegistry = {}) {
    const config: EventLogServiceOptions = options instanceof EventSchemaRegistry ? { registry: options } : options;
    this.registry = config.registry ?? new EventSchemaRegistry();
    this.querySource = config.querySource ?? sinks.find(isEventLogQuerySource);
    this.diagnosticReporter = config.diagnosticReporter ?? new EventDiagnosticReporter({
      ...(config.onDiagnostic === undefined ? {} : { onDiagnostic: config.onDiagnostic }),
      ...(config.diagnosticFactory === undefined ? {} : { factory: config.diagnosticFactory }),
      ...(config.publishDiagnostic === undefined ? {} : { publishDiagnostic: config.publishDiagnostic }),
      ...(config.maxSuppressedDiagnostics === undefined ? {} : { maxSuppressedDiagnostics: config.maxSuppressedDiagnostics }),
    });
    this.now = config.now ?? (() => new Date().toISOString());
  }

  public record(event: EventEnvelope): void {
    const snapshot = snapshotEventEnvelope(event);
    if (!snapshot.ok) {
      this.report({ error: snapshot.error });
      return;
    }
    let stored = snapshot.value;
    const descriptor = this.registry.resolve(stored.type, stored.eventVersion);
    if (descriptor?.redact !== undefined) {
      let redacted: unknown;
      let parsedPayload: unknown;
      try {
        parsedPayload = descriptor.parsePayload(stored.payload);
      } catch {
        this.report({
          error: eventError("event.schema.invalid-payload", "Event descriptor rejected payload before redaction.", "$event.payload"),
          eventId: stored.id,
          eventType: stored.type,
          correlationId: stored.correlationId,
          ...(stored.causationId === undefined ? {} : { causationId: stored.causationId }),
        }, stored);
        return;
      }
      try {
        redacted = descriptor.redact(parsedPayload);
      } catch {
        this.report({
          error: eventError("event.redaction.failed", "Event payload redaction failed.", "$event.payload"),
          eventId: stored.id,
          eventType: stored.type,
          correlationId: stored.correlationId,
          ...(stored.causationId === undefined ? {} : { causationId: stored.causationId }),
        }, stored);
        return;
      }
      const safeRedaction = snapshotJsonValue(redacted, "$event.payload");
      if (!safeRedaction.ok) {
        this.report({
          error: eventError("event.redaction.failed", safeRedaction.error.message, safeRedaction.error.path),
          eventId: stored.id,
          eventType: stored.type,
          correlationId: stored.correlationId,
          ...(stored.causationId === undefined ? {} : { causationId: stored.causationId }),
        }, stored);
        return;
      }
      stored = Object.freeze({ ...stored, payload: safeRedaction.value });
    }
    const sinkFailures: Array<{ readonly diagnostic: EventLogDiagnostic; readonly source: EventEnvelope }> = [];
    for (let index = 0; index < this.sinks.length; index += 1) {
      const sink = this.sinks[index];
      if (sink === undefined) continue;
      try {
        sink.write(stored);
      } catch {
        sinkFailures.push({
          diagnostic: {
            error: eventError("event.sink.failed", "Event log sink failed."),
            eventId: stored.id,
            eventType: stored.type,
            correlationId: stored.correlationId,
            ...(stored.causationId === undefined ? {} : { causationId: stored.causationId }),
            sinkIndex: index,
          },
          source: stored,
        });
      }
    }
    for (const failure of sinkFailures) this.report(failure.diagnostic, failure.source);
  }

  public query(filter: EventLogFilter = {}): EventLogQueryResult {
    if (this.querySource === undefined) return { events: [], matchedCount: 0, totalRetained: 0, evictedCount: 0, truncatedByLimit: false };
    return this.querySource.query(filter);
  }

  public exportJson(filter: EventLogFilter = {}): string {
    const result = this.query(filter);
    return exportEventLogSnapshot(result.events, this.querySource?.getRetentionMetadata() ?? emptyRetention(), filter, this.now());
  }

  public exportSnapshot(filter: EventLogFilter = {}): string {
    return this.exportJson(filter);
  }

  public get registryInstance(): EventSchemaRegistry {
    return this.registry;
  }

  public getRegistry(): EventSchemaRegistry {
    return this.registry;
  }

  public getDiagnostics(): EventDiagnosticReporter {
    return this.diagnosticReporter;
  }

  private report(diagnostic: EventLogDiagnostic, source?: EventEnvelope): void {
    this.diagnosticReporter.report(diagnostic, source);
  }
}

function emptyRetention(): EventLogRetentionMetadata {
  return { capacity: 0, retainedCount: 0, evictedCount: 0 };
}

function isEventLogQuerySource(sink: EventLogSink): sink is EventLogSink & EventLogQuerySource {
  const candidate = sink as Partial<EventLogQuerySource>;
  return typeof candidate.query === "function" && typeof candidate.getRetentionMetadata === "function" && typeof candidate.snapshot === "function";
}
