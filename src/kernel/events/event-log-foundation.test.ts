import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "./contracts";
import { EventEnvelopeFactory, createEventSequenceSource } from "./event-envelope-factory";
import { NamespacedEventBus } from "./namespaced-event-bus";
import { EventDiagnosticReporter } from "./diagnostic-reporter";
import { eventError } from "./event-errors";
import { snapshotEventEnvelope, snapshotJsonValue } from "./json-snapshot";

function makeEvent(sequence: number, type = "building.part.added", payload: unknown = { value: sequence }): EventEnvelope {
  return {
    id: `event-${String(sequence)}`,
    type,
    eventVersion: 1,
    occurredAt: "2026-01-01T00:00:00.000Z",
    observedAt: "2026-01-01T00:00:00.000Z",
    sequence,
    severity: "info",
    producer: "test",
    correlationId: "correlation",
    context: { test: true },
    payload,
  } as EventEnvelope;
}

describe("event JSON snapshots", () => {
  it("copies and freezes nested JSON without freezing caller input", () => {
    const source = { nested: { count: 1 }, values: [true, "ok"] };
    const result = snapshotJsonValue(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    source.nested.count = 9;
    expect(result.value).toEqual({ nested: { count: 1 }, values: [true, "ok"] });
    expect((result.value as { readonly nested: { readonly count: number } }).nested.count).toBe(1);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen((result.value as { readonly nested: object }).nested)).toBe(true);
  });

  it.each([undefined, NaN, Infinity, 1n, () => undefined, new Date(), new Map()])("rejects non JSON-safe value %p", (value) => {
    expect(snapshotJsonValue(value).ok).toBe(false);
  });

  it("rejects cycles, sparse arrays and accessors but accepts shared references", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(snapshotJsonValue(cyclic).ok).toBe(false);
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(snapshotJsonValue(sparse).ok).toBe(false);
    let getterCalled = false;
    const withGetter = Object.defineProperty({}, "value", { get: () => { getterCalled = true; return 1; }, enumerable: true });
    expect(snapshotJsonValue(withGetter).ok).toBe(false);
    expect(getterCalled).toBe(false);
    const shared = { value: 1 };
    expect(snapshotJsonValue({ a: shared, b: shared }).ok).toBe(true);
    const arrayWithHiddenProperty: unknown[] = [1];
    Object.defineProperty(arrayWithHiddenProperty, "hidden", { value: 2, enumerable: false });
    expect(snapshotJsonValue(arrayWithHiddenProperty).ok).toBe(false);
  });

  it("preserves special JSON keys without changing the output prototype", () => {
    const value = JSON.parse('{"__proto__":{"secret":"kept"},"constructor":"data"}') as Record<string, unknown>;
    const result = snapshotJsonValue(value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(JSON.stringify(result.value))).toEqual(JSON.parse('{"__proto__":{"secret":"kept"},"constructor":"data"}'));
    expect(Object.getPrototypeOf(result.value)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(result.value, "__proto__")).toBe(true);
  });

  it("validates and snapshots a complete envelope", () => {
    const source = makeEvent(1);
    const result = snapshotEventEnvelope(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.context)).toBe(true);
    expect(result.value).not.toBe(source);
  });

  it("rejects envelope accessors without executing them", () => {
    let reads = 0;
    const source = makeEvent(1) as unknown as Record<string, unknown>;
    Object.defineProperty(source, "id", { enumerable: true, get: () => { reads += 1; return "event-1"; } });
    expect(snapshotEventEnvelope(source).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("rejects non-primitive severities without coercion or retaining the caller value", () => {
    let toStringCalls = 0;
    const customSeverity = { toString: () => { toStringCalls += 1; return "info"; } };
    for (const severity of [customSeverity, []]) {
      const source = { ...makeEvent(1), severity } as unknown as Record<string, unknown>;
      const result = snapshotEventEnvelope(source);
      expect(result).toMatchObject({ ok: false, error: { code: "event.envelope.invalid", path: "$event.severity" } });
    }
    expect(toStringCalls).toBe(0);
  });
});

describe("event envelope factory", () => {
  it("creates correlated and causated events with injectable dependencies", () => {
    let id = 0;
    let now = 0;
    const factory = new EventEnvelopeFactory({
      id: () => `id-${String(++id)}`,
      now: () => `2026-01-01T00:00:0${String(now++)}.000Z`,
      sequence: createEventSequenceSource(),
      producer: "test.factory",
    });
    const correlationId = factory.startCorrelation();
    const first = factory.create({ type: "building.command.received", eventVersion: 1, payload: { command: "add" }, producer: "test.ui", correlationId });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = factory.derive(first.value, { type: "building.part.added", eventVersion: 1, payload: { partId: "p1" } });
    expect(second).toMatchObject({ ok: true, value: { correlationId, causationId: first.value.id, sequence: 2, producer: "test.factory" } });
    expect(first.value.sequence).toBe(1);
  });

  it("rejects invalid factory input without mutating the input", () => {
    const input = { type: "", eventVersion: 0, payload: { value: 1 }, producer: "test", correlationId: "c" } as const;
    expect(new EventEnvelopeFactory().create(input).ok).toBe(false);
    expect(input.payload.value).toBe(1);
  });

  it("rejects factory accessors and converts clock dependency failures to typed errors", () => {
    let reads = 0;
    const withGetter = {
      type: "test.event",
      eventVersion: 1,
      correlationId: "c",
      severity: "info" as const,
      get payload(): { value: number } {
        reads += 1;
        return { value: 1 };
      },
    };
    const accessorResult = new EventEnvelopeFactory({ id: () => "event-1", now: () => "2026-01-01T00:00:00.000Z" }).create(withGetter);
    expect(accessorResult).toMatchObject({ ok: false, error: { code: "event.envelope.invalid" } });
    expect(reads).toBe(0);

    const clockResult = new EventEnvelopeFactory({ id: () => "event-1", now: () => { throw new Error("clock failed"); } }).create({ type: "test.event", eventVersion: 1, correlationId: "c", payload: {} });
    expect(clockResult).toMatchObject({ ok: false, error: { code: "event.clock.invalid", path: "$event.occurredAt" } });

    const idResult = new EventEnvelopeFactory({ id: () => { throw new Error("id failed"); }, now: () => "2026-01-01T00:00:00.000Z" }).create({ type: "test.event", eventVersion: 1, correlationId: "c", payload: {} });
    expect(idResult).toMatchObject({ ok: false, error: { code: "event.id.invalid", path: "$event.id" } });

    const sequenceResult = new EventEnvelopeFactory({ id: () => "event-1", now: () => "2026-01-01T00:00:00.000Z", sequence: () => { throw new Error("sequence failed"); } }).create({ type: "test.event", eventVersion: 1, correlationId: "c", payload: {} });
    expect(sequenceResult).toMatchObject({ ok: false, error: { code: "event.sequence.invalid", path: "$event.sequence" } });
  });

  it("accepts only primitive severities and snapshots factory metadata", () => {
    const severityObject = { toString: () => "info" };
    const invalid = new EventEnvelopeFactory({ id: () => "event-1", now: () => "2026-01-01T00:00:00.000Z" }).create({ type: "test.event", eventVersion: 1, correlationId: "c", payload: {}, severity: severityObject as never });
    expect(invalid).toMatchObject({ ok: false, error: { code: "event.envelope.invalid", path: "$event.severity" } });

    const payload = { nested: { value: 1 } };
    const context = { machineId: "m1" };
    const result = new EventEnvelopeFactory({ id: () => "event-1", now: () => "2026-01-01T00:00:00.000Z" }).create({ type: "test.event", eventVersion: 1, correlationId: "c", payload, context });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    payload.nested.value = 9;
    context.machineId = "m2";
    expect(result.value.payload).toEqual({ nested: { value: 1 } });
    expect(result.value.context).toEqual({ machineId: "m1" });
    expect(result.value.payload).not.toBe(payload);
    expect(result.value.context).not.toBe(context);
  });
});

describe("namespaced event bus", () => {
  it("matches exact, namespace and global patterns in registration order", () => {
    const bus = new NamespacedEventBus();
    const received: string[] = [];
    bus.subscribe("building.part.added", () => received.push("exact"));
    bus.subscribe("building.*", () => received.push("namespace"));
    bus.subscribe("*", () => received.push("global"));
    bus.publish(makeEvent(1, "building.part.added"));
    bus.publish(makeEvent(2, "buildingish.part.added"));
    expect(received).toEqual(["exact", "namespace", "global", "global"]);
  });

  it("supports idempotent unsubscribe and a stable subscriber snapshot", () => {
    const bus = new NamespacedEventBus();
    const received: string[] = [];
    let removeFirst: () => void = () => undefined;
    removeFirst = bus.subscribe("*", () => { received.push("first"); removeFirst(); });
    bus.subscribe("*", () => received.push("second"));
    bus.publish(makeEvent(1));
    bus.publish(makeEvent(2));
    removeFirst();
    expect(received).toEqual(["first", "second", "second"]);
  });

  it("queues reentrant publishes until all subscribers see the current event", () => {
    const bus = new NamespacedEventBus();
    const received: string[] = [];
    bus.subscribe("*", (event) => {
      received.push(`a:${String(event.sequence)}`);
      if (event.sequence === 1) bus.publish(makeEvent(2));
    });
    bus.subscribe("*", (event) => { received.push(`b:${String(event.sequence)}`); });
    bus.publish(makeEvent(1));
    expect(received).toEqual(["a:1", "b:1", "a:2", "b:2"]);
  });

  it("isolates subscriber errors and reports invalid or out-of-order events", () => {
    const diagnostics: string[] = [];
    const bus = new NamespacedEventBus({ onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.error.code) });
    const received: number[] = [];
    bus.subscribe("*", () => { throw new Error("broken"); });
    bus.subscribe("*", (event) => received.push(event.sequence));
    bus.publish(makeEvent(1));
    bus.publish(makeEvent(1));
    expect(received).toEqual([1]);
    expect(diagnostics).toContain("event.subscriber.failed");
    expect(diagnostics).toContain("event.sequence.invalid");
  });

  it("bounds recursive publish chains", () => {
    const diagnostics: string[] = [];
    const bus = new NamespacedEventBus({ maxNestedPublishes: 2, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.error.code) });
    bus.subscribe("*", (event) => { bus.publish(makeEvent(event.sequence + 1)); });
    bus.publish(makeEvent(1));
    expect(diagnostics).toContain("event.publish.limit");
  });

  it("suppresses diagnostic reentry when a diagnostic handler publishes a rejected event", () => {
    const diagnostics: string[] = [];
    const event = makeEvent(1);
    const bus = new NamespacedEventBus({ onDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic.error.code);
      bus.publish(event);
    } });
    bus.publish(event);
    bus.publish(event);
    expect(diagnostics).toEqual(["event.sequence.invalid"]);
    expect(bus.getDiagnostics().suppressedCount).toBe(1);
  });

  it("creates diagnostic envelopes with shared sequence and source causation", () => {
    const sequence = createEventSequenceSource(1);
    const emitted: EventEnvelope[] = [];
    const reporter = new EventDiagnosticReporter({
      factory: new EventEnvelopeFactory({ id: (() => { let id = 0; return () => `diagnostic-${String(++id)}`; })(), now: () => "2026-01-01T00:00:00.000Z", sequence: () => sequence.next(), producer: "diagnostic.test" }),
      publishDiagnostic: (diagnostic) => { emitted.push(diagnostic); },
    });
    const bus = new NamespacedEventBus({ diagnosticReporter: reporter });
    bus.subscribe("*", () => { throw new Error("broken"); });
    const source = makeEvent(1);
    bus.publish(source);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ type: "event.diagnostic", sequence: 2, correlationId: source.correlationId, causationId: source.id, payload: { errorCode: "event.subscriber.failed", sourceEventId: source.id, sourceEventType: source.type } });
    expect(Object.isFrozen(emitted[0])).toBe(true);
  });

  it("keeps diagnostic suppression observable across reports", () => {
    const seen: Array<{ code: string; suppressedCount?: number }> = [];
    const holder: { current?: EventDiagnosticReporter } = {};
    const reporter = new EventDiagnosticReporter({ onDiagnostic: (diagnostic) => {
      seen.push({ code: diagnostic.error.code, ...(diagnostic.suppressedCount === undefined ? {} : { suppressedCount: diagnostic.suppressedCount }) });
      if (seen.length === 1) holder.current?.report({ error: eventError("event.secondary", "secondary") });
    } });
    holder.current = reporter;
    reporter.report({ error: eventError("event.primary", "primary") });
    expect(reporter.suppressedCount).toBe(1);
    reporter.report({ error: eventError("event.next", "next") });
    expect(seen).toEqual([{ code: "event.primary" }, { code: "event.next", suppressedCount: 1 }]);
  });

  it("rejects unsupported patterns", () => {
    const bus = new NamespacedEventBus();
    expect(() => bus.subscribe("building.*.added", () => undefined)).toThrow();
    expect(() => bus.subscribe("building.*.*", () => undefined)).toThrow();
    expect(() => bus.subscribe("building*.*", () => undefined)).toThrow();
    expect(() => bus.subscribe("", () => undefined)).toThrow();
  });
});
