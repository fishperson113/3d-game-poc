import type { MachineBuildingService } from "../../building/application/machine-building-service";

export class BuildModeController {
  private host: HTMLElement | undefined;

  public constructor(private readonly building: MachineBuildingService) {}

  public mount(host: HTMLElement): void {
    this.host = host;
    host.dataset.buildModeOwner = this.building.constructor.name;
  }

  public dispose(): void {
    if (this.host !== undefined) delete this.host.dataset.buildModeOwner;
    this.host = undefined;
  }
}
