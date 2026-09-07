import type { EventPublisher } from "../../kernel/events/contracts";
import type { Result } from "../../kernel/result";
import type { MachineBlueprint } from "../domain/contracts";
import type { MachineRepository } from "../ports/machine-repository";
import type { PartCatalog } from "../ports/part-catalog";

export interface BuildingCommandError { readonly code: string }

export class MachineBuildingService {
  public constructor(
    private readonly repository: MachineRepository,
    private readonly catalog: PartCatalog,
    private readonly events: EventPublisher,
  ) {}

  public describeDependencies(): readonly string[] {
    // TODO(plan-02): Replace this scaffold seam with command handlers.
    return [this.repository.constructor.name, this.catalog.constructor.name, this.events.constructor.name];
  }

  public async load(machineId: string): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    // TODO(plan-02): Return typed not-found and publish correlated command events.
    const blueprint = await this.repository.get(machineId);
    return blueprint === undefined
      ? { ok: false, error: { code: "building.machine.not-found" } }
      : { ok: true, value: blueprint };
  }
}
