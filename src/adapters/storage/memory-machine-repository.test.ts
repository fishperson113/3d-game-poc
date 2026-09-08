import { describe, expect, it } from "vitest";
import { asMachineId, asPartId, type MachineBlueprint } from "../../building/domain/contracts";
import { MemoryMachineRepository } from "./memory-machine-repository";

const blueprint: MachineBlueprint = { schemaVersion: 1, id: asMachineId("m"), version: 0, parts: [], connections: [], controlBindings: [] };

describe("MemoryMachineRepository", () => {
  it("stores isolated snapshots and enforces optimistic versions", async () => {
    const repository = new MemoryMachineRepository();
    expect((await repository.save(blueprint)).ok).toBe(true);
    const loaded = await repository.get("m");
    expect(loaded).toEqual(blueprint);
    if (loaded === undefined) return;
    const updated: MachineBlueprint = { ...loaded, version: 1, parts: [{ id: asPartId("p"), definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }] };
    expect((await repository.save(updated, 0)).ok).toBe(true);
    expect((await repository.save({ ...updated, version: 2 })).ok).toBe(false);
    expect((await repository.save({ ...updated, version: 2 }, 0)).ok).toBe(false);
    (loaded.parts as Array<typeof loaded.parts[number]>).push({ id: asPartId("mutated"), definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } });
    expect((await repository.get("m"))?.parts).toHaveLength(1);
  });
});
