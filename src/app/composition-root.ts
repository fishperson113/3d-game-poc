import { ConsoleEventLogSink, KeyboardInputSource, MemoryEventLogSink, MemoryMachineRepository, RapierPhysicsWorld } from "../adapters";
import { MachineBuildingService } from "../building";
import { EventLogService } from "../event-log";
import { EventEnvelopeFactory, createEventSequenceSource, NamespacedEventBus, type EventEnvelope } from "../kernel/events";
import { StaticPartCatalog } from "../parts";
import { SimulationCompiler, SimulationSession } from "../simulation";
import type { PhysicsWorld } from "../simulation";
import type { SimulationRenderer } from "../simulation/ports/simulation-renderer";
import type { JsonValue } from "../kernel/json";
import type { RuntimeTelemetryEvent, RuntimeTelemetrySink } from "../simulation/ports/runtime-telemetry";

export interface ApplicationComposition {
  readonly building: MachineBuildingService;
  readonly catalog: StaticPartCatalog;
  readonly simulationCompiler: SimulationCompiler;
  readonly events: NamespacedEventBus;
  readonly eventFactory: EventEnvelopeFactory;
  readonly eventLog: EventLogService;
  readonly memoryLog: MemoryEventLogSink;
  createSimulationSession(world: PhysicsWorld, renderer: SimulationRenderer): SimulationSession;
  emit(type: string, payload: JsonValue, severity?: EventEnvelope["severity"]): void;
}

export function createApplicationComposition(): ApplicationComposition {
  const sequence = createEventSequenceSource();
  const eventFactory = new EventEnvelopeFactory({ sequence, producer: "sandbox.application" });
  const memoryLog = new MemoryEventLogSink({ capacity: 1500 });
  const eventLog = new EventLogService([memoryLog, new ConsoleEventLogSink()]);
  const events = new NamespacedEventBus();
  events.subscribe("*", (event) => { eventLog.record(event); });
  const createTelemetry = (producer: string): RuntimeTelemetrySink => (event: RuntimeTelemetryEvent): void => {
    const created = eventFactory.create({ type: event.type, eventVersion: 1, severity: event.severity ?? "debug", producer, correlationId: eventFactory.startCorrelation(), payload: event.payload, ...(event.tags === undefined ? {} : { tags: event.tags }) });
    if (created.ok) events.publish(created.value);
  };
  const catalog = new StaticPartCatalog();
  const building = new MachineBuildingService(new MemoryMachineRepository(), catalog, events, {
    id: () => eventFactory.startCorrelation(),
    now: () => new Date().toISOString(),
    producer: "sandbox.building",
    sequence: () => sequence.next(),
  });
  const simulationCompiler = new SimulationCompiler({ createPhysicsWorld: () => new RapierPhysicsWorld({ telemetry: createTelemetry("sandbox.physics") }), catalog, events });
  return {
    building,
    catalog,
    simulationCompiler,
    events,
    eventFactory,
    eventLog,
    memoryLog,
    createSimulationSession: (world, renderer) => {
      const telemetry = createTelemetry("sandbox.runtime");
      return new SimulationSession(world, new KeyboardInputSource({ telemetry }), renderer, { telemetry });
    },
    emit: (type, payload, severity = "info") => {
      const created = eventFactory.create({ type, eventVersion: 1, severity, correlationId: eventFactory.startCorrelation(), payload });
      if (created.ok) events.publish(created.value);
    },
  };
}
