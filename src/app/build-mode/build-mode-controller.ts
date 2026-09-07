import type { MachineBuildingService } from "../../building/application/machine-building-service";

export class BuildModeController {
  public constructor(private readonly building: MachineBuildingService) {}

  public mount(host: HTMLElement): void {
    // TODO(plan-05): Bind palette/picking actions through application commands.
    void host;
    void this.building;
  }

  public dispose(): void {
    // TODO(plan-05): Remove delegated DOM listeners.
  }
}
