import { describe, expect, it } from "vitest";
import { Machine } from "./machine";
import { parseMachineBlueprint } from "./blueprint";
import { normalizePartConfiguration, type PartDefinition } from "./part-definition";

const pose = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
const definition: PartDefinition = {
  id: "block", version: 1, capabilities: [],
  sockets: ["b:c", "c", "s"].map((id) => ({ id, accepts: ["mount"], tags: ["mount"], position: [0, 0, 0] })),
};
const dependencies = { resolvePart: () => definition };

describe("Plan 02 closure regressions", () => {
  it("rejects sparse transforms on import and commands without mutation", () => {
    const sparse = [...pose.position];
    Reflect.deleteProperty(sparse, "1");
    const invalidPose = { ...pose, position: sparse as [number, number, number] };
    expect(parseMachineBlueprint({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "p", definitionId: "block", transform: invalidPose }], connections: [], controlBindings: [] }, dependencies)).toMatchObject({ ok: false, error: { code: "building.transform.invalid" } });
    const created = Machine.create("m", dependencies);
    if (!created.ok) throw new Error(created.error.code);
    const machine = created.value;
    expect(machine.addPart({ id: "p", definitionId: "block", transform: pose }).ok).toBe(true);
    const before = machine.blueprint;
    expect(machine.movePart("p", invalidPose)).toMatchObject({ ok: false, error: { code: "building.transform.invalid" } });
    expect(machine.addPart({ id: "q", definitionId: "block", transform: invalidPose }).ok).toBe(false);
    expect(machine.blueprint).toEqual(before);
  });

  it("round-trips distinct socket tuples containing colons and rejects actual occupancy", () => {
    const created = Machine.create("m", dependencies);
    if (!created.ok) throw new Error(created.error.code);
    const machine = created.value;
    for (const id of ["a", "a:b", "x", "y"]) expect(machine.addPart({ id, definitionId: "block", transform: pose }).ok).toBe(true);
    const first = { id: "c1", a: { partId: "a", socketId: "b:c" }, b: { partId: "x", socketId: "s" }, joint: { type: "fixed" as const } };
    const second = { id: "c2", a: { partId: "a:b", socketId: "c" }, b: { partId: "y", socketId: "s" }, joint: { type: "fixed" as const } };
    for (const connection of [first, second]) expect(machine.connectParts(connection).ok).toBe(true);
    const restored = Machine.restore(machine.blueprint, dependencies);
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value.blueprint).toEqual(machine.blueprint);
    expect(parseMachineBlueprint({ ...machine.blueprint, connections: [first, second, { ...first, id: "duplicate" }] }, dependencies)).toMatchObject({ ok: false, error: { code: "building.socket.occupied" } });
  });

  it.each([200, -1, Number.NaN, Number.POSITIVE_INFINITY, "wrong", null])("rejects invalid numeric default %s", (value) => {
    const configured: PartDefinition = { ...definition, configurationSchema: { fields: { torque: { type: "number", default: value, min: 0, max: 100 } } } };
    expect(normalizePartConfiguration(configured, undefined)).toMatchObject({ ok: false, code: "building.part.configuration-invalid", field: "torque" });
    const created = Machine.create("m", { resolvePart: () => configured });
    if (!created.ok) throw new Error(created.error.code);
    expect(created.value.addPart({ id: "p", definitionId: "block", transform: pose }).ok).toBe(false);
    expect(created.value.blueprint.parts).toHaveLength(0);
  });

  it("applies valid defaults, validates overrides and rejects inherited field names", () => {
    const configured: PartDefinition = { ...definition, configurationSchema: { fields: { torque: { type: "number", default: 20, min: 0, max: 100 } } } };
    expect(normalizePartConfiguration(configured, undefined)).toEqual({ ok: true, value: { torque: 20 } });
    expect(normalizePartConfiguration(configured, { torque: 0 })).toEqual({ ok: true, value: { torque: 0 } });
    expect(normalizePartConfiguration(configured, { torque: 200 }).ok).toBe(false);
    expect(normalizePartConfiguration(configured, { toString: "unknown" }).ok).toBe(false);
  });
});
