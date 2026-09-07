import type { MachineBlueprint } from "./contracts";
import type { PartDefinition } from "./part-definition";

export interface MachineDependencies {
  readonly resolvePart: (definitionId: string) => PartDefinition | undefined;
}

export class Machine {
  public constructor(
    public readonly blueprint: MachineBlueprint,
    public readonly dependencies: MachineDependencies,
  ) {}

  // TODO(plan-02): Implement aggregate commands and invariants.
}
