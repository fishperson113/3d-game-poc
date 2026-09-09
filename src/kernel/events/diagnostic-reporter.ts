import type { JsonValue } from "../json";
import type { EventEnvelope } from "./contracts";
import { eventError, type EventInfrastructureError } from "./event-errors";
import type { EventEnvelopeFactory } from "./event-envelope-factory";
import type { Result } from "../result";

export interface DiagnosticRecord {
  readonly error: EventInfrastructureError;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly pattern?: string;
  readonly subscriberIndex?: number;
  readonly sinkIndex?: number;
  readonly suppressedCount?: number;
}

export interface EventDiagnosticReporterOptions {
  readonly onDiagnostic?: (diagnostic: DiagnosticRecord) => void;
  readonly factory?: EventEnvelopeFactory;
  readonly publishDiagnostic?: (event: EventEnvelope) => void;
  readonly diagnosticType?: string;
  readonly maxSuppressedDiagnostics?: number;
}

export class EventDiagnosticReporter {
  private readonly onDiagnostic: (diagnostic: DiagnosticRecord) => void;
  private readonly factory: EventEnvelopeFactory | undefined;
  private readonly publishDiagnostic: ((event: EventEnvelope) => void) | undefined;
  private readonly diagnosticType: string;
  private readonly maxSuppressedDiagnostics: number;
  private reporting = false;
  private suppressedForActiveReport = 0;
  private suppressedTotal = 0;
  private droppedTotal = 0;
  private reportedTotal = 0;
  private callbackFailureTotal = 0;
  private lastDiagnosticEnvelope: EventEnvelope | undefined;

  public constructor(options: EventDiagnosticReporterOptions = {}) {
    this.onDiagnostic = options.onDiagnostic ?? (() => undefined);
    this.factory = options.factory;
    this.publishDiagnostic = options.publishDiagnostic;
    this.diagnosticType = options.diagnosticType ?? "event.diagnostic";
    this.maxSuppressedDiagnostics = options.maxSuppressedDiagnostics ?? 100;
    if (typeof this.diagnosticType !== "string" || this.diagnosticType.length === 0) throw new Error("diagnosticType must be a non-empty string.");
    if (!Number.isSafeInteger(this.maxSuppressedDiagnostics) || this.maxSuppressedDiagnostics < 1) {
      throw new Error("maxSuppressedDiagnostics must be a positive safe integer.");
    }
  }

  public get suppressedCount(): number {
    return this.suppressedTotal;
  }

  public get droppedCount(): number {
    return this.droppedTotal;
  }

  public get reportedCount(): number {
    return this.reportedTotal;
  }

  public get callbackFailureCount(): number {
    return this.callbackFailureTotal;
  }

  public get lastEnvelope(): EventEnvelope | undefined {
    return this.lastDiagnosticEnvelope;
  }

  public getSuppressedCount(): number {
    return this.suppressedTotal;
  }

  public getDroppedCount(): number {
    return this.droppedTotal;
  }

  public report(record: DiagnosticRecord, source?: EventEnvelope): void {
    if (this.isDiagnosticEvent(source) || this.reporting) {
      this.suppress();
      return;
    }

    this.reporting = true;
    this.reportedTotal += 1;
    const suppressedBeforeReport = this.suppressedForActiveReport;
    this.suppressedForActiveReport = 0;
    const visibleRecord: DiagnosticRecord = {
      ...record,
      ...(suppressedBeforeReport === 0 ? {} : { suppressedCount: suppressedBeforeReport }),
    };
    try {
      try {
        this.onDiagnostic(visibleRecord);
      } catch {
        this.callbackFailureTotal += 1;
      }
      // A callback may synchronously trigger another diagnostic. Update the
      // same record object so a retained diagnostic reference can observe the
      // suppression count after the outer report returns.
      if (this.suppressedForActiveReport > 0) {
        Object.assign(visibleRecord, { suppressedCount: this.suppressedForActiveReport });
      }
      const envelope = this.createEnvelope(visibleRecord, source);
      if (envelope.ok) {
        this.lastDiagnosticEnvelope = envelope.value;
        if (this.publishDiagnostic !== undefined) {
          try {
            this.publishDiagnostic(envelope.value);
          } catch {
            this.droppedTotal += 1;
          }
        }
      } else if (this.factory !== undefined) {
        this.droppedTotal += 1;
      }
    } finally {
      this.reporting = false;
    }
  }

  public createEnvelope(record: DiagnosticRecord, source?: EventEnvelope): Result<EventEnvelope, EventInfrastructureError> {
    if (this.factory === undefined) {
      return { ok: false, error: eventError("event.diagnostic.unconfigured", "No diagnostic envelope factory is configured.", "$diagnostic") };
    }
    const correlationId = record.correlationId ?? source?.correlationId ?? this.createCorrelationId();
    if (correlationId === undefined) {
      return { ok: false, error: eventError("event.diagnostic.invalid", "A diagnostic correlation ID could not be created.", "$diagnostic.correlationId") };
    }
    const causationId = record.eventId ?? source?.id;
    const payload: Record<string, JsonValue> = {
      errorCode: record.error.code,
      message: record.error.message,
      ...(record.error.path === undefined ? {} : { path: record.error.path }),
      ...(record.error.details === undefined ? {} : { details: record.error.details }),
      ...(record.eventId === undefined ? {} : { sourceEventId: record.eventId }),
      ...(record.eventType === undefined ? {} : { sourceEventType: record.eventType }),
      ...(record.pattern === undefined ? {} : { pattern: record.pattern }),
      ...(record.subscriberIndex === undefined ? {} : { subscriberIndex: record.subscriberIndex }),
      ...(record.sinkIndex === undefined ? {} : { sinkIndex: record.sinkIndex }),
      ...(record.suppressedCount === undefined ? {} : { suppressedCount: record.suppressedCount }),
    };
    return this.factory.create({
      type: this.diagnosticType,
      eventVersion: 1,
      severity: "error",
      correlationId,
      ...(causationId === undefined ? {} : { causationId }),
      context: {
        ...(record.eventId === undefined ? {} : { sourceEventId: record.eventId }),
        ...(record.eventType === undefined ? {} : { sourceEventType: record.eventType }),
      },
      tags: ["diagnostic", "error"],
      payload,
    });
  }

  private createCorrelationId(): string | undefined {
    try {
      return this.factory?.startCorrelation();
    } catch {
      return undefined;
    }
  }

  private isDiagnosticEvent(source: EventEnvelope | undefined): boolean {
    return source !== undefined && (source.type === this.diagnosticType || source.tags?.includes("diagnostic") === true);
  }

  private suppress(): void {
    if (this.suppressedForActiveReport < this.maxSuppressedDiagnostics) {
      this.suppressedForActiveReport += 1;
      this.suppressedTotal += 1;
    } else {
      this.droppedTotal += 1;
    }
  }
}
