import type { EventEnvelope, EventPublisher } from "./contracts";
import { eventError } from "./event-errors";
import { EventDiagnosticReporter, type DiagnosticRecord } from "./diagnostic-reporter";
import { snapshotEventEnvelope } from "./json-snapshot";
import type { EventEnvelopeFactory } from "./event-envelope-factory";

export type EventBusDiagnostic = DiagnosticRecord;

export interface NamespacedEventBusOptions {
  readonly onDiagnostic?: (diagnostic: EventBusDiagnostic) => void;
  readonly diagnosticReporter?: EventDiagnosticReporter;
  readonly diagnosticFactory?: EventEnvelopeFactory;
  readonly publishDiagnostic?: (event: EventEnvelope) => void;
  readonly maxSuppressedDiagnostics?: number;
  readonly maxNestedPublishes?: number;
}

interface Subscription {
  readonly pattern: string;
  readonly handler: (event: EventEnvelope) => void;
  active: boolean;
}

function matches(pattern: string, type: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const namespace = pattern.slice(0, -2);
    return namespace.length > 0 && type.startsWith(`${namespace}.`);
  }
  return pattern === type;
}

function validPattern(pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.length === 0) return false;
  if (pattern.endsWith(".*")) {
    const namespace = pattern.slice(0, -2);
    return namespace.length > 0 && namespace.split(".").every((part) => part.length > 0 && !part.includes("*"));
  }
  return !pattern.includes("*") && pattern.split(".").every((part) => part.length > 0);
}

export class NamespacedEventBus implements EventPublisher {
  private readonly subscriptions: Subscription[] = [];
  private readonly diagnosticReporter: EventDiagnosticReporter;
  private readonly maxNestedPublishes: number;
  private readonly queue: EventEnvelope[] = [];
  private dispatching = false;
  private nestedPublishes = 0;
  private lastSequence = 0;

  public constructor(options: NamespacedEventBusOptions = {}) {
    this.diagnosticReporter = options.diagnosticReporter ?? new EventDiagnosticReporter({
      ...(options.onDiagnostic === undefined ? {} : { onDiagnostic: options.onDiagnostic }),
      ...(options.diagnosticFactory === undefined ? {} : { factory: options.diagnosticFactory }),
      ...(options.publishDiagnostic === undefined ? {} : { publishDiagnostic: options.publishDiagnostic }),
      ...(options.maxSuppressedDiagnostics === undefined ? {} : { maxSuppressedDiagnostics: options.maxSuppressedDiagnostics }),
    });
    this.maxNestedPublishes = options.maxNestedPublishes ?? 1000;
    if (!Number.isSafeInteger(this.maxNestedPublishes) || this.maxNestedPublishes < 1) throw new Error("maxNestedPublishes must be a positive safe integer.");
  }

  public subscribe(pattern: string, handler: (event: EventEnvelope) => void): () => void {
    if (!validPattern(pattern)) throw new Error(`Invalid event subscription pattern: ${pattern}`);
    const subscription: Subscription = { pattern, handler, active: true };
    this.subscriptions.push(subscription);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      subscription.active = false;
      const index = this.subscriptions.indexOf(subscription);
      if (index >= 0) this.subscriptions.splice(index, 1);
    };
  }

  public publish(event: EventEnvelope): void {
    const snapshot = snapshotEventEnvelope(event);
    if (!snapshot.ok) {
      this.report({ error: snapshot.error });
      return;
    }
    if (snapshot.value.sequence <= this.lastSequence) {
      this.report({
        error: eventError("event.sequence.invalid", "Event sequence must increase monotonically for a live bus.", "$event.sequence", { lastSequence: this.lastSequence }),
        eventId: snapshot.value.id,
        eventType: snapshot.value.type,
        correlationId: snapshot.value.correlationId,
        ...(snapshot.value.causationId === undefined ? {} : { causationId: snapshot.value.causationId }),
      }, snapshot.value);
      return;
    }
    this.lastSequence = snapshot.value.sequence;
    this.queue.push(snapshot.value);
    if (this.dispatching) {
      this.nestedPublishes += 1;
      if (this.nestedPublishes > this.maxNestedPublishes) {
        this.queue.length = 0;
        this.report({ error: eventError("event.publish.limit", "Nested event publish limit exceeded.", "$event") }, snapshot.value);
        return;
      }
      return;
    }
    this.dispatching = true;
    try {
      while (this.queue.length > 0) {
        const current = this.queue.shift();
        if (current === undefined) continue;
        const currentSubscribers = this.subscriptions.filter((subscription) => subscription.active && matches(subscription.pattern, current.type));
        for (let index = 0; index < currentSubscribers.length; index += 1) {
          const subscription = currentSubscribers[index];
          if (subscription === undefined) continue;
          try {
            subscription.handler(current);
          } catch {
            this.report({
              error: eventError("event.subscriber.failed", "Event subscriber failed while handling an event."),
              eventId: current.id,
              eventType: current.type,
              correlationId: current.correlationId,
              ...(current.causationId === undefined ? {} : { causationId: current.causationId }),
              pattern: subscription.pattern,
              subscriberIndex: index,
            }, current);
          }
        }
      }
    } finally {
      this.dispatching = false;
      this.nestedPublishes = 0;
    }
  }

  public clear(): void {
    this.queue.length = 0;
    for (const subscription of this.subscriptions) subscription.active = false;
    this.subscriptions.length = 0;
  }

  public getDiagnostics(): EventDiagnosticReporter {
    return this.diagnosticReporter;
  }

  private report(diagnostic: EventBusDiagnostic, source?: EventEnvelope): void {
    this.diagnosticReporter.report(diagnostic, source);
  }
}

export { matches as matchesEventPattern };
