import {
  BundledLevelRepository,
  ConsoleEventLogSink,
  KeyboardInputSource,
  MemoryMachineRepository,
  RapierPhysicsWorld,
  ThreeSimulationRenderer,
} from "../adapters";
import { MachineBuildingService } from "../building";
import { LoadLevel } from "../challenge";
import { EventLogService } from "../event-log";
import type { EventEnvelope, EventPublisher } from "../kernel/events/contracts";
import { StaticPartCatalog } from "../parts";
import { SimulationCompiler, SimulationSession } from "../simulation";

class ScaffoldEventPublisher implements EventPublisher {
  public publish(event: EventEnvelope): void {
    // TODO(plan-01): Replace with the namespaced in-process event bus.
    void event;
  }

  public subscribe(pattern: string, handler: (event: EventEnvelope) => void): () => void {
    // TODO(plan-01): Implement exact and wildcard subscriptions.
    void pattern;
    void handler;
    return () => undefined;
  }
}

export interface ApplicationComposition {
  readonly building: MachineBuildingService;
  readonly loadLevel: LoadLevel;
  readonly simulationCompiler: SimulationCompiler;
  readonly eventLog: EventLogService;
  createSimulationSession(): SimulationSession;
}

export function createApplicationComposition(): ApplicationComposition {
  const events = new ScaffoldEventPublisher();
  const eventLog = new EventLogService([new ConsoleEventLogSink()]);
  const building = new MachineBuildingService(new MemoryMachineRepository(), new StaticPartCatalog(), events);
  const loadLevel = new LoadLevel(new BundledLevelRepository(), events);
  const simulationCompiler = new SimulationCompiler({ createPhysicsWorld: () => new RapierPhysicsWorld(), events });

  return {
    building,
    loadLevel,
    simulationCompiler,
    eventLog,
    createSimulationSession: () => new SimulationSession(
      new RapierPhysicsWorld(),
      new KeyboardInputSource(),
      new ThreeSimulationRenderer(),
    ),
  };
}
