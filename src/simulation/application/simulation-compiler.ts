import type { MachineBlueprint } from "../../building/domain/contracts";
import type { LoadedLevel } from "../../challenge/domain/contracts";
import type { EventPublisher } from "../../kernel/events/contracts";
import type { PhysicsWorld } from "../ports/physics-world";

export interface SimulationCompilerDependencies {
  readonly createPhysicsWorld: () => PhysicsWorld;
  readonly events: EventPublisher;
}

export class SimulationCompiler {
  public constructor(private readonly dependencies: SimulationCompilerDependencies) {}

  public compile(blueprint: MachineBlueprint, level: LoadedLevel): PhysicsWorld {
    // TODO(plan-05): Compile in stable order and dispose atomically on failure.
    void blueprint;
    void level;
    void this.dependencies.events;
    return this.dependencies.createPhysicsWorld();
  }
}
