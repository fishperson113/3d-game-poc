import type { MachineBlueprint } from "../../building/domain/contracts";
import type { MachineRepository } from "../../building/ports/machine-repository";

export class MemoryMachineRepository implements MachineRepository {
  public async get(machineId: string): Promise<MachineBlueprint | undefined> {
    // TODO(plan-02): Store immutable versioned blueprints in memory.
    void machineId;
    return Promise.resolve(undefined);
  }

  public async save(blueprint: MachineBlueprint): Promise<void> {
    // TODO(plan-02): Add optimistic version checking.
    void blueprint;
    await Promise.resolve();
  }
}
