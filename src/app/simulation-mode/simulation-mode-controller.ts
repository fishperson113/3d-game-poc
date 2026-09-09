import type { SimulationCompiler } from "../../simulation/application/simulation-compiler";

export class SimulationModeController {
  private host: HTMLElement | undefined;

  public constructor(private readonly compiler: SimulationCompiler) {}

  public mount(host: HTMLElement): void {
    this.host = host;
    host.dataset.simulationModeOwner = this.compiler.constructor.name;
  }

  public dispose(): void {
    if (this.host !== undefined) delete this.host.dataset.simulationModeOwner;
    this.host = undefined;
  }
}
