import type { MachineBlueprint } from "../domain/contracts";

export interface MachineRepository {
  get(machineId: string): Promise<MachineBlueprint | undefined>;
  save(blueprint: MachineBlueprint): Promise<void>;
}

// TODO(plan-02): Add optimistic version conflict result.
