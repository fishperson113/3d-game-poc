import type { MachineBlueprint } from "../../building/domain/contracts";
import type { MachineRepository, MachineRepositorySaveResult } from "../../building/ports/machine-repository";
import { cloneBlueprint } from "../../building/domain/machine";

export class MemoryMachineRepository implements MachineRepository {
  private readonly machines = new Map<string, MachineBlueprint>();

  public async get(machineId: string): Promise<MachineBlueprint | undefined> {
    const blueprint = this.machines.get(machineId);
    await Promise.resolve();
    return blueprint === undefined ? undefined : cloneBlueprint(blueprint);
  }

  public async save(blueprint: MachineBlueprint, expectedVersion?: number): Promise<MachineRepositorySaveResult> {
    const current = this.machines.get(blueprint.id);
    if (blueprint.version < 0 || !Number.isInteger(blueprint.version)) return { ok: false, code: "building.repository.invalid-version" };
    if (current === undefined) {
      if (expectedVersion !== undefined && expectedVersion !== -1) return { ok: false, code: "building.repository.version-conflict" };
    } else {
      if (expectedVersion === undefined || expectedVersion !== current.version || blueprint.version <= current.version) return { ok: false, code: "building.repository.version-conflict" };
    }
    this.machines.set(blueprint.id, cloneBlueprint(blueprint));
    await Promise.resolve();
    return { ok: true };
  }
}
