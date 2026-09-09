import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "../kernel/events/contracts";
import { EventSchemaRegistry } from "./domain/event-schema-registry";
import { EventLogService } from "./application/event-log-service";
import { MemoryEventLogSink } from "../adapters/event-log/memory-event-log-sink";
import { ConsoleEventLogSink, type ConsoleWriter } from "../adapters/event-log/console-event-log-sink";
import { exportEventLogSnapshot } from "./application/event-log-export";
import { EventDiagnosticReporter, EventEnvelopeFactory, NamespacedEventBus, createEventSequenceSource } from "../kernel/events";
import { MachineBuildingService } from "../building/application/machine-building-service";
import { MemoryMachineRepository } from "../adapters/storage/memory-machine-repository";
import { FourWheelFixtureCatalog } from "../building/fixtures/four-wheel-catalog";

function makeEvent(sequence: number, type = "test.event", payload: unknown = { value: sequence }, tags?: readonly string[]): EventEnvelope {
  return {
    id: `event-${String(sequence)}`,
    type,
    eventVersion: 1,
    occurredAt: `2026-01-01T00:00:0${String(sequence)}.000Z`,
    observedAt: `2026-01-01T00:00:0${String(sequence)}.000Z`,
    sequence,
    severity: sequence % 2 === 0 ? "warn" : "info",
    producer: "test",
    correlationId: sequence < 3 ? "corr-a" : "corr-b",
    context: { source: "test" },
    ...(tags === undefined ? {} : { tags }),
    payload,
  } as EventEnvelope;
}

describe("EventSchemaRegistry", () => {
  it("rejects duplicate descriptors and upcasts one version at a time", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "test.event", version: 1, parsePayload: (input: unknown) => input as { value: number }, summarize: (payload) => `value=${String(payload.value)}` });
    registry.register({ type: "test.event", version: 2, parsePayload: (input: unknown) => input as { value: number; label: string }, summarize: (payload) => payload.label });
    registry.register({ type: "test.event", version: 3, parsePayload: (input: unknown) => input as { value: number; label: string; ready: boolean }, summarize: (payload) => `${payload.label}:${String(payload.ready)}` });
    registry.registerUpcaster({ type: "test.event", fromVersion: 1, toVersion: 2, upcast: (payload) => ({ ...(payload as { value: number }), label: "v2" }) });
    registry.registerUpcaster({ type: "test.event", fromVersion: 2, toVersion: 3, upcast: (payload) => ({ ...(payload as { value: number; label: string }), ready: true }) });
    expect(() => { registry.register({ type: "test.event", version: 1, parsePayload: (input: unknown) => input, summarize: () => "duplicate" }); }).toThrow(/event\.schema\.duplicate/);
    const projected = registry.project({ ...makeEvent(1), eventVersion: 1, payload: { value: 4 } });
    expect(projected).toMatchObject({ ok: true, value: { version: 3, sourceVersion: 1, migrationChain: [2, 3], payload: { value: 4, label: "v2", ready: true } } });
  });

  it("keeps unknown events generic and does not mutate the source payload", () => {
    const registry = new EventSchemaRegistry();
    const payload = { value: 1 };
    const event = makeEvent(1, "unknown.event", payload);
    const projected = registry.project(event);
    expect(projected).toMatchObject({ ok: true, value: { known: false, payload } });
    payload.value = 9;
    expect((projected as { ok: true; value: { payload: { value: number } } }).value.payload.value).toBe(1);
  });

  it("does not rewrite a raw envelope when projecting an upcast version", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "test.event", version: 1, parsePayload: (input: unknown) => input as { value: number }, summarize: () => "v1" });
    registry.register({ type: "test.event", version: 2, parsePayload: (input: unknown) => input as { value: number; ready: boolean }, summarize: () => "v2" });
    registry.registerUpcaster({ type: "test.event", fromVersion: 1, toVersion: 2, upcast: (input) => ({ ...(input as { value: number }), ready: true }) });
    const raw = makeEvent(1, "test.event", { value: 7 });
    const projected = registry.project(raw);
    expect(projected).toMatchObject({ ok: true, value: { version: 2, payload: { value: 7, ready: true } } });
    expect(raw.payload).toEqual({ value: 7 });
  });

  it("reports missing migration and parser failures", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "test.event", version: 1, parsePayload: () => { throw new Error("invalid"); }, summarize: () => "never" });
    expect(registry.project(makeEvent(1))).toMatchObject({ ok: false, error: { code: "event.schema.invalid-payload" } });
    const missing = new EventSchemaRegistry();
    missing.register({ type: "test.event", version: 1, parsePayload: (input: unknown) => input, summarize: () => "v1" });
    missing.register({ type: "test.event", version: 2, parsePayload: (input: unknown) => input, summarize: () => "v2" });
    expect(missing.project(makeEvent(1))).toMatchObject({ ok: false, error: { code: "event.upcast.failed" } });
  });

  it("uses each version parser result as the immutable migration projection", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "test.event", version: 1, parsePayload: (input: unknown) => input as { value: number }, summarize: () => "v1" });
    registry.register({ type: "test.event", version: 2, parsePayload: (input: unknown) => ({ ...(input as { value: number }), normalized: true }), summarize: () => "v2" });
    registry.registerUpcaster({ type: "test.event", fromVersion: 1, toVersion: 2, upcast: (input) => input });
    const projected = registry.project(makeEvent(1, "test.event", { value: 5 }));
    expect(projected).toMatchObject({ ok: true, value: { version: 2, payload: { value: 5, normalized: true } } });
  });
});

describe("memory event log and service", () => {
  it("evicts in O(1)-style ring order, filters and exposes retention metadata", () => {
    const memory = new MemoryEventLogSink({ capacity: 2 });
    memory.write(makeEvent(1, "level.load.started", { value: 1 }, ["application"]));
    memory.write(makeEvent(2, "level.load.failed", { value: 2 }, ["error"]));
    memory.write(makeEvent(3, "building.part.added", { value: 3 }, ["domain"]));
    expect(memory.snapshot().map((event) => event.sequence)).toEqual([2, 3]);
    expect(memory.getRetentionMetadata()).toMatchObject({ capacity: 2, retainedCount: 2, evictedCount: 1, oldestSequence: 2, newestSequence: 3 });
    expect(memory.query({ namespace: "level.*", tags: ["error"], tagMode: "all" }).events.map((event) => event.sequence)).toEqual([2]);
    expect(memory.query({ afterSequence: 1, limit: 1 }).truncatedByLimit).toBe(true);
    expect(() => memory.query({ namespace: "level.*.*" })).toThrow(/event\.filter\.invalid/);
    expect(() => memory.query({ namespace: "level*.*" })).toThrow(/event\.filter\.invalid/);
  });

  it("filters observed time by instant and routes console severity", () => {
    const memory = new MemoryEventLogSink({ capacity: 4 });
    memory.write({ ...makeEvent(1), observedAt: "2026-01-01T01:00:00.000+01:00" });
    memory.write({ ...makeEvent(2), observedAt: "2026-01-01T01:30:00.000+01:00" });
    expect(memory.query({ observedFrom: "2026-01-01T00:15:00.000Z", observedTo: "2026-01-01T00:45:00.000Z" }).events.map((event) => event.sequence)).toEqual([2]);

    const calls: string[] = [];
    const writer: ConsoleWriter = {
      debug: (message) => { calls.push(`debug:${message}`); },
      info: (message) => { calls.push(`info:${message}`); },
      warn: (message) => { calls.push(`warn:${message}`); },
      error: (message) => { calls.push(`error:${message}`); },
    };
    new ConsoleEventLogSink({ console: writer }).write(makeEvent(2));
    expect(calls[0]).toMatch(/^warn:\[warn\] #2 test\.event correlation=corr-a/);
  });

  it("excludes raw physics records while retaining semantic events", () => {
    const memory = new MemoryEventLogSink({ capacity: 4 });
    memory.write(makeEvent(1, "physics.contact.raw", { handle: 10 }, ["physics.raw"]));
    memory.write(makeEvent(2, "simulation.goal.entered", { goalId: "goal" }, ["simulation"]));
    expect(memory.snapshot().map((event) => event.type)).toEqual(["simulation.goal.entered"]);
  });

  it("keeps unknown events queryable/exportable and isolates retention policy failures", () => {
    const diagnostics: string[] = [];
    const memory = new MemoryEventLogSink({ capacity: 4, shouldRetain: () => { throw new Error("policy failure"); }, onDiagnostic: (error) => diagnostics.push(error.code) });
    memory.write(makeEvent(1, "unknown.event", { opaque: true }));
    expect(memory.snapshot()).toHaveLength(0);
    expect(diagnostics).toEqual(["event.sink.failed"]);

    const retained = new MemoryEventLogSink({ capacity: 4 });
    retained.write(makeEvent(2, "unknown.event", { opaque: true }));
    const log = new EventLogService([retained]);
    expect(log.query({ namespace: "unknown.*" }).events[0]?.type).toBe("unknown.event");
    expect((JSON.parse(log.exportJson()) as { events: Array<{ type: string }> }).events[0]?.type).toBe("unknown.event");
  });

  it("isolates memory listeners and clears retention state without affecting writes", () => {
    const memory = new MemoryEventLogSink({ capacity: 2 });
    let notifications = 0;
    const unsubscribe = memory.subscribe(() => { notifications += 1; });
    memory.subscribe(() => { throw new Error("viewer failure"); });
    memory.write(makeEvent(1));
    expect(notifications).toBe(1);
    unsubscribe();
    unsubscribe();
    memory.clear();
    expect(memory.snapshot()).toHaveLength(0);
    expect(memory.getRetentionMetadata()).toMatchObject({ retainedCount: 0, evictedCount: 0 });
    expect(notifications).toBe(1);
  });

  it("redacts before sinks, isolates sink failure and exports a JSON snapshot", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "sensitive.event", version: 1, parsePayload: (input: unknown) => input as { public: string; secret: string }, summarize: (payload) => payload.public, redact: (payload) => ({ public: payload.public }) });
    const memory = new MemoryEventLogSink({ capacity: 4 });
    const failures: string[] = [];
    const service = new EventLogService([
      { write: () => { throw new Error("sink down"); } },
      memory,
    ], { registry, querySource: memory, onDiagnostic: (diagnostic) => failures.push(diagnostic.error.code), now: () => "2026-01-02T00:00:00.000Z" });
    const event = makeEvent(1, "sensitive.event", { public: "ok", secret: "do-not-log" }, ["domain"]);
    service.record(event);
    expect(memory.snapshot()[0]?.payload).toEqual({ public: "ok" });
    expect(event.payload).toEqual({ public: "ok", secret: "do-not-log" });
    expect(failures).toEqual(["event.sink.failed"]);
    const exported = JSON.parse(service.exportJson({ correlationId: "corr-a" })) as { schemaVersion: number; events: Array<{ payload: unknown }> };
    expect(exported.schemaVersion).toBe(1);
    expect(exported.events[0]?.payload).toEqual({ public: "ok" });
    expect(exportEventLogSnapshot(memory.snapshot(), memory.getRetentionMetadata())).toContain('"events"');
  });

  it("writes sink diagnostics as ordered envelopes with source causation", () => {
    const memory = new MemoryEventLogSink({ capacity: 8 });
    const sequence = createEventSequenceSource(1);
    const reporter = new EventDiagnosticReporter({
      factory: new EventEnvelopeFactory({ id: (() => { let id = 0; return () => `diagnostic-${String(++id)}`; })(), now: () => "2026-01-02T00:00:00.000Z", sequence: () => sequence.next(), producer: "event-log.test" }),
      publishDiagnostic: (event) => { memory.write(event); },
    });
    const service = new EventLogService([
      memory,
      { write: () => { throw new Error("sink down"); } },
    ], { diagnosticReporter: reporter });
    const source = makeEvent(1, "test.event", { value: 1 });
    service.record(source);
    expect(memory.snapshot().map((event) => event.sequence)).toEqual([1, 2]);
    expect(memory.snapshot()[1]).toMatchObject({ type: "event.diagnostic", correlationId: source.correlationId, causationId: source.id, payload: { errorCode: "event.sink.failed", sourceEventId: source.id, sourceEventType: source.type } });
    const exported = JSON.parse(service.exportJson()) as { events: Array<{ sequence: number }> };
    expect(exported.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("suppresses diagnostic events re-entering a queued bus, including custom types", () => {
    const memory = new MemoryEventLogSink({ capacity: 8 });
    const log = new EventLogService([memory]);
    const sequence = createEventSequenceSource(1);
    const emitted: EventEnvelope[] = [];
    const busHolder: { current?: NamespacedEventBus } = {};
    const reporter = new EventDiagnosticReporter({
      diagnosticType: "event.infrastructure.failure",
      factory: new EventEnvelopeFactory({ id: (() => { let id = 0; return () => `diagnostic-${String(++id)}`; })(), now: () => "2026-01-02T00:00:00.000Z", sequence: () => sequence.next(), producer: "event-log.test" }),
      publishDiagnostic: (event) => { emitted.push(event); busHolder.current?.publish(event); },
    });
    const bus = new NamespacedEventBus({ diagnosticReporter: reporter, maxNestedPublishes: 3 });
    busHolder.current = bus;
    const received: string[] = [];
    bus.subscribe("*", () => { throw new Error("subscriber failure"); });
    bus.subscribe("*", (event) => { received.push(event.type); log.record(event); });

    bus.publish(makeEvent(1));

    expect(emitted).toHaveLength(1);
    expect(received).toEqual(["test.event", "event.infrastructure.failure"]);
    expect(memory.snapshot().map((event) => event.sequence)).toEqual([1, 2]);
    expect(reporter.reportedCount).toBe(1);
    expect(reporter.suppressedCount).toBe(1);
    expect(memory.getRetentionMetadata()).toMatchObject({ oldestSequence: 1, newestSequence: 2 });
    const exported = JSON.parse(log.exportJson()) as { events: Array<{ type: string; sequence: number }> };
    expect(exported.events.map((event) => [event.type, event.sequence])).toEqual([["test.event", 1], ["event.infrastructure.failure", 2]]);
  });

  it("defers multiple sink diagnostics until the source event reaches every sink", () => {
    const memory = new MemoryEventLogSink({ capacity: 8 });
    const sequence = createEventSequenceSource(1);
    const reporter = new EventDiagnosticReporter({
      factory: new EventEnvelopeFactory({ id: (() => { let id = 0; return () => `diagnostic-${String(++id)}`; })(), now: () => "2026-01-02T00:00:00.000Z", sequence: () => sequence.next(), producer: "event-log.test" }),
      publishDiagnostic: (event) => { memory.write(event); },
    });
    const service = new EventLogService([
      { write: () => { throw new Error("sink one down"); } },
      memory,
      { write: () => { throw new Error("sink three down"); } },
    ], { diagnosticReporter: reporter });

    service.record(makeEvent(1));

    expect(memory.snapshot().map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(memory.snapshot().map((event) => event.payload)).toEqual([
      { value: 1 },
      expect.objectContaining({ errorCode: "event.sink.failed", sinkIndex: 0 }),
      expect.objectContaining({ errorCode: "event.sink.failed", sinkIndex: 2 }),
    ]);
    expect(memory.getRetentionMetadata()).toMatchObject({ oldestSequence: 1, newestSequence: 3, retainedCount: 3 });
    const exported = JSON.parse(service.exportJson()) as { events: Array<{ sequence: number }> };
    expect(exported.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it("does not fall back to raw payload when redaction fails", () => {
    const registry = new EventSchemaRegistry();
    registry.register({ type: "sensitive.event", version: 1, parsePayload: (input: unknown) => input, summarize: () => "secret", redact: () => { throw new Error("redaction failed"); } });
    const memory = new MemoryEventLogSink({ capacity: 4 });
    const errors: string[] = [];
    const service = new EventLogService([memory], { registry, onDiagnostic: (diagnostic) => errors.push(diagnostic.error.code) });
    service.record(makeEvent(1, "sensitive.event", { secret: "do-not-log" }));
    expect(memory.snapshot()).toHaveLength(0);
    expect(errors).toEqual(["event.redaction.failed"]);
  });

  it("integrates the real Building producer with one shared event sequence", async () => {
    const sequence = createEventSequenceSource();
    let id = 0;
    const bus = new NamespacedEventBus();
    const memory = new MemoryEventLogSink({ capacity: 32 });
    const log = new EventLogService([memory]);
    bus.subscribe("*", (event) => { log.record(event); });
    const building = new MachineBuildingService(
      new MemoryMachineRepository(),
      new FourWheelFixtureCatalog(),
      bus,
      { id: () => `building-${String(++id)}`, now: () => "2026-01-03T00:00:00.000Z", sequence: () => sequence.next() },
    );

    const created = await building.create("machine-1", "corr-create");
    const rejected = await building.removePart("machine-1", "missing-part", "corr-reject");
    expect(created.ok).toBe(true);
    expect(rejected).toMatchObject({ ok: false, error: { code: "building.part.not-found" } });

    const events = memory.snapshot();
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(events.map((event) => event.correlationId)).toEqual(["corr-create", "corr-create", "corr-reject", "corr-reject"]);
    expect(events[3]).toMatchObject({ type: "building.command.rejected", causationId: events[2]?.id, payload: { errorCode: "building.part.not-found" } });
  });
});
