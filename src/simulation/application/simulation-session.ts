import { FIXED_TIMESTEP_SECONDS } from "../../kernel/runtime-contract";
import type { InputSource } from "../ports/input-source";
import type { PhysicsWorld } from "../ports/physics-world";
import type { SimulationRenderer } from "../ports/simulation-renderer";

const MAX_FRAME_SECONDS = 0.25;
const MAX_CATCH_UP_STEPS = 5;

export interface SimulationSessionStats {
  readonly steps: number;
  readonly accumulatorSeconds: number;
  readonly world: ReturnType<PhysicsWorld["getStats"]>;
}

export class SimulationSession {
  private accumulator = 0;
  private disposed = false;
  private running = false;

  public constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputSource,
    private readonly renderer: SimulationRenderer,
  ) {}

  public start(): void {
    if (this.disposed) throw new Error("simulation.session.disposed");
    if (this.running) return;
    this.running = true;
    this.renderer.render(this.physics.snapshot());
  }

  public advance(deltaSeconds: number): number {
    if (!this.running || this.disposed) return 0;
    this.accumulator = Math.min(MAX_FRAME_SECONDS, this.accumulator + Math.max(0, deltaSeconds));
    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP_SECONDS && steps < MAX_CATCH_UP_STEPS) {
      this.physics.setControls(this.input.read());
      this.physics.step(FIXED_TIMESTEP_SECONDS);
      this.accumulator -= FIXED_TIMESTEP_SECONDS;
      steps += 1;
    }
    if (steps > 0) this.renderer.render(this.physics.snapshot());
    return steps;
  }

  public stop(): void {
    this.running = false;
    this.accumulator = 0;
    this.input.reset?.();
  }

  public getStats(): SimulationSessionStats {
    return { steps: this.physics.getStats().steps, accumulatorSeconds: this.accumulator, world: this.physics.getStats() };
  }

  public dispose(options: { readonly disposeInput?: boolean; readonly disposeRenderer?: boolean } = {}): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.accumulator = 0;
    this.input.reset?.();
    if (options.disposeInput !== false) this.input.dispose();
    if (options.disposeRenderer !== false) this.renderer.dispose();
    this.physics.dispose();
  }

  public describeFixedStep(): number {
    return FIXED_TIMESTEP_SECONDS;
  }
}
