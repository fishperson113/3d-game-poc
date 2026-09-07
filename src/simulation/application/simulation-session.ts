import { FIXED_TIMESTEP_SECONDS } from "../../kernel/runtime-contract";
import type { InputSource } from "../ports/input-source";
import type { PhysicsWorld } from "../ports/physics-world";
import type { SimulationRenderer } from "../ports/simulation-renderer";

export class SimulationSession {
  public constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputSource,
    private readonly renderer: SimulationRenderer,
  ) {}

  public describeFixedStep(): number {
    // TODO(plan-05): Add accumulator, bounded catch-up and transform snapshots.
    void this.physics;
    void this.input;
    void this.renderer;
    return FIXED_TIMESTEP_SECONDS;
  }
}
