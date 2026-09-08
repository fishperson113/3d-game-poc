import { describe, expect, it } from "vitest";
import { exportMachineBlueprint, parseMachineBlueprint } from "./blueprint";

describe("MachineBlueprint codec", () => {
  it("round-trips semantic data and isolates snapshots", () => {
    const input = { schemaVersion: 1, id: "m", version: 2, parts: [{ id: "p", definitionId: "core.block", transform: { position: [1, 2, 3], rotation: [0, 0, 0] }, configuration: { mass: 2 } }], connections: [], controlBindings: [] };
    const parsed = parseMachineBlueprint(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const exported = exportMachineBlueprint(parsed.value);
    expect(exported).toEqual(input);
    expect(exported).not.toBe(parsed.value);
  });

  it("rejects duplicate ids and dangling references", () => {
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [
      { id: "p", definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } },
      { id: "p", definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } },
    ], connections: [], controlBindings: [] })).toMatchObject({ ok: false, error: { code: "building.part.duplicate-id" } });
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [], connections: [{ id: "c", a: { partId: "missing", socketId: "s" }, b: { partId: "missing", socketId: "s" }, joint: { type: "fixed" } }], controlBindings: [] })).toMatchObject({ ok: false, error: { code: "building.blueprint.dangling-connection" } });
  });

  it("validates definitions, sockets and capabilities when a catalog is supplied", () => {
    const catalog = {
      resolvePart: (id: string) => id === "block" ? { id: "block", version: 1, sockets: [{ id: "mount", accepts: ["mount"], tags: ["mount"], position: [0, 0, 0] as [number, number, number] }], capabilities: ["motor"] } : undefined,
    };
    const parsed = parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }], connections: [], controlBindings: [{ id: "b", action: "drive", partId: "p", capability: "missing" }] }, catalog);
    expect(parsed).toMatchObject({ ok: false, error: { code: "building.control.capability-not-found" } });
  });

  it("rejects duplicate control targets and same-socket connections on import", () => {
    const catalog = {
      resolvePart: () => ({ id: "block", version: 1, sockets: [{ id: "mount", accepts: ["mount"], tags: ["mount"], position: [0, 0, 0] as [number, number, number] }], capabilities: ["motor"] }),
    };
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }], connections: [{ id: "same", a: { partId: "p", socketId: "mount" }, b: { partId: "p", socketId: "mount" }, joint: { type: "fixed" } }], controlBindings: [] })).toMatchObject({ ok: false, error: { code: "building.connection.same-socket" } });
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }], connections: [], controlBindings: [{ id: "b1", action: "drive", partId: "p", capability: "motor" }, { id: "b2", action: "drive", partId: "p", capability: "motor" }] }, catalog)).toMatchObject({ ok: false, error: { code: "building.control.duplicate-target" } });
  });

  it("rejects cyclic and class instance configuration", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] }, configuration: cyclic }], connections: [], controlBindings: [] })).toMatchObject({ ok: false, error: { code: "building.part.configuration-invalid" } });
    class Config { public readonly value = 1; }
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "x", transform: { position: [0, 0, 0], rotation: [0, 0, 0] }, configuration: new Config() }], connections: [], controlBindings: [] })).toMatchObject({ ok: false, error: { code: "building.part.configuration-invalid" } });
  });
});
