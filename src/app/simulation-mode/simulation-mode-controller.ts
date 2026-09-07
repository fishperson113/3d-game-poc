import type { SimulationCompiler } from "../../simulation/application/simulation-compiler";

export class SimulationModeController {
  public constructor(private readonly compiler: SimulationCompiler) {}

  public mount(host: HTMLElement): void {
    // TODO(plan-05): Wire Start/Stop/Reset to the runtime state machine.
    void host;
    void this.compiler;
  }

  public dispose(): void {
    // TODO(plan-05): Stop the active session and release UI listeners.
  }
}
