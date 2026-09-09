import { FIXED_TIMESTEP_SECONDS } from "../../kernel/runtime-contract";
import type { ControlState, InputSource } from "../ports/input-source";
import type { PhysicsWorld } from "../ports/physics-world";
import type { SimulationRenderer } from "../ports/simulation-renderer";
import type { RuntimeTelemetrySink } from "../ports/runtime-telemetry";
import type { SimulationFrame } from "../ports/simulation-renderer";
import { quaternionNormalize } from "../../kernel/math";

const MAX_FRAME_SECONDS = 0.25;
const MAX_CATCH_UP_STEPS = 5;
const STEP_EPSILON_SECONDS = 1e-10;

export interface SimulationSessionStats {
  readonly steps: number;
  readonly accumulatorSeconds: number;
  readonly world: ReturnType<PhysicsWorld["getStats"]>;
}

export interface SimulationSessionOptions {
  readonly telemetry?: RuntimeTelemetrySink;
}

export class SimulationSession {
  private accumulator = 0;
  private disposed = false;
  private running = false;
  private lastControls: ControlState = { throttle: 0, steering: 0 };
  private readonly telemetry: RuntimeTelemetrySink | undefined;
  private previousFrame: SimulationFrame | undefined;
  private currentFrame: SimulationFrame | undefined;
  private droppedSeconds = 0;
  private telemetrySeconds = 0;

  public constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputSource,
    private readonly renderer: SimulationRenderer,
    options: SimulationSessionOptions = {},
  ) { this.telemetry = options.telemetry; }

  public start(): void {
    if (this.disposed) throw new Error("simulation.session.disposed");
    if (this.running) return;
    try {
      this.currentFrame = this.physics.snapshot();
      this.previousFrame = this.currentFrame;
      this.renderer.render(this.currentFrame);
      this.running = true;
    } catch (error) {
      this.running = false;
      throw error;
    }
  }

  public advance(deltaSeconds: number): number {
    if (!this.running || this.disposed) return 0;
    if (!Number.isFinite(deltaSeconds)) return 0;
    const wallSeconds = Math.max(0, deltaSeconds);
    this.telemetrySeconds += wallSeconds;
    const accumulated = this.accumulator + wallSeconds;
    if (accumulated > MAX_FRAME_SECONDS) this.droppedSeconds += accumulated - MAX_FRAME_SECONDS;
    this.accumulator = Math.min(MAX_FRAME_SECONDS, accumulated);
    let steps = 0;
    while (this.accumulator + STEP_EPSILON_SECONDS >= FIXED_TIMESTEP_SECONDS && steps < MAX_CATCH_UP_STEPS) {
      const controls = this.input.read();
      if (controls.throttle !== this.lastControls.throttle || controls.steering !== this.lastControls.steering) {
        this.publish({ type: "simulation.controls.applied", payload: { throttle: controls.throttle, steering: controls.steering, physicsStep: this.physics.getStats().steps }, severity: "debug", tags: ["input", "physics", "simulation.controls"] });
      }
      this.lastControls = controls;
      this.physics.setControls(this.lastControls);
      this.previousFrame = this.currentFrame;
      this.physics.step(FIXED_TIMESTEP_SECONDS);
      this.currentFrame = this.physics.snapshot();
      this.accumulator -= FIXED_TIMESTEP_SECONDS;
      if (this.accumulator < 0 && this.accumulator > -STEP_EPSILON_SECONDS) this.accumulator = 0;
      steps += 1;
    }
    if (steps === MAX_CATCH_UP_STEPS && this.accumulator + STEP_EPSILON_SECONDS >= FIXED_TIMESTEP_SECONDS) {
      const droppedSeconds = this.accumulator - this.accumulator % FIXED_TIMESTEP_SECONDS;
      this.accumulator %= FIXED_TIMESTEP_SECONDS;
      this.droppedSeconds += droppedSeconds;
    }
    if (this.telemetrySeconds >= 1) {
      if (this.droppedSeconds > 0) this.publish({ type: "simulation.time.dropped", payload: { droppedSeconds: this.droppedSeconds, intervalSeconds: this.telemetrySeconds }, severity: "warn", tags: ["simulation", "performance"] });
      this.telemetrySeconds = 0;
      this.droppedSeconds = 0;
    }
    if (this.currentFrame !== undefined && this.previousFrame !== undefined) {
      this.renderer.render(interpolateFrame(this.previousFrame, this.currentFrame, this.accumulator / FIXED_TIMESTEP_SECONDS));
    }
    return steps;
  }

  public stop(): void {
    this.running = false;
    this.accumulator = 0;
    this.input.reset?.();
    this.lastControls = { throttle: 0, steering: 0 };
  }

  public getStats(): SimulationSessionStats {
    return { steps: this.physics.getStats().steps, accumulatorSeconds: this.accumulator, world: this.physics.getStats() };
  }

  public dispose(options: { readonly disposeInput?: boolean; readonly disposeRenderer?: boolean } = {}): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.accumulator = 0;
    const errors: unknown[] = [];
    try { this.input.reset?.(); } catch (error) { errors.push(error); }
    this.lastControls = { throttle: 0, steering: 0 };
    if (options.disposeInput !== false) {
      try { this.input.dispose(); } catch (error) { errors.push(error); }
    }
    if (options.disposeRenderer !== false) {
      try { this.renderer.dispose(); } catch (error) { errors.push(error); }
    }
    try { this.physics.dispose(); } catch (error) { errors.push(error); }
    if (errors.length > 0) throw new AggregateError(errors, "simulation.session.dispose-failed");
  }

  public describeFixedStep(): number {
    return FIXED_TIMESTEP_SECONDS;
  }

  public getLastControls(): ControlState {
    return this.lastControls;
  }

  private publish(event: Parameters<RuntimeTelemetrySink>[0]): void {
    try {
      this.telemetry?.(event);
    } catch {
      // Telemetry must never break the fixed-step loop.
    }
  }
}

/** Shortest-path normalized quaternion interpolation; never mutates physics state. */
export function interpolateFrame(previous: SimulationFrame, current: SimulationFrame, alpha: number): SimulationFrame {
  const t = Math.max(0, Math.min(1, alpha));
  const transforms: Record<string, SimulationFrame["transforms"][string]> = {};
  for (const [id, pose] of Object.entries(current.transforms)) {
    const before = previous.transforms[id] ?? pose;
    const sign = before.rotation.reduce((sum, value, index) => sum + value * (pose.rotation[index] ?? 0), 0) < 0 ? -1 : 1;
    transforms[id] = {
      position: [0, 1, 2].map((index) => (before.position[index] ?? 0) * (1 - t) + (pose.position[index] ?? 0) * t) as [number, number, number],
      rotation: quaternionNormalize([0, 1, 2, 3].map((index) => (before.rotation[index] ?? 0) * (1 - t) + sign * (pose.rotation[index] ?? 0) * t) as [number, number, number, number]),
    };
  }
  return { step: current.step, transforms };
}
