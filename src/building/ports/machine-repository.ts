import type { MachineBlueprint } from "../domain/contracts";

export type MachineRepositorySaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "building.repository.version-conflict" | "building.repository.invalid-version" };

export interface MachineRepository {
  get(machineId: string): Promise<MachineBlueprint | undefined>;
  save(blueprint: MachineBlueprint, expectedVersion?: number): Promise<MachineRepositorySaveResult>;
}
