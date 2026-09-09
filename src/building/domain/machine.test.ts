import { describe, expect, it } from "vitest";
import type { PartDefinition } from "./part-definition";
import { Machine } from "./machine";

const mount = (id: string, singleUse = true) => ({ id, accepts: ["mount"], tags: ["mount"], position: [0, 0, 0] as [number, number, number], singleUse });
const block: PartDefinition = { id: "block", version: 1, sockets: [mount("left"), mount("right")], capabilities: [] };
const wheel: PartDefinition = { id: "wheel", version: 1, sockets: [mount("axle")], capabilities: ["motor"], configurationSchema: { fields: { torque: { type: "number", default: 10, min: 0, max: 100 } } } };
const incompatible: PartDefinition = { id: "incompatible", version: 1, sockets: [{ id: "foreign", accepts: ["foreign"], tags: ["foreign"], position: [0, 0, 0] }], capabilities: [] };
const dependencies = { resolvePart: (id: string) => ({ block, wheel, incompatible }[id]) };
const transform = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };

function restore(input: Parameters<typeof Machine.restore>[0]): Machine {
  const result = Machine.restore(input, dependencies);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("Machine aggregate", () => {
  it("creates and mutates a blueprint with stable revisions", () => {
    const created = Machine.create("machine-1", dependencies);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const machine = created.value;
    expect(machine.addPart({ id: "chassis", definitionId: "block", transform }).ok).toBe(true);
    expect(machine.addPart({ id: "wheel", definitionId: "wheel", transform }).ok).toBe(true);
    expect(machine.blueprint.version).toBe(2);
    expect(machine.rotatePart("wheel", "y").ok).toBe(true);
    expect(machine.blueprint.parts[1]?.transform.rotation[1]).toBeCloseTo(Math.PI / 2);
  });

  it("rejects incompatible and duplicate socket connections without mutation", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [
      { id: "a", definitionId: "block", transform },
      { id: "b", definitionId: "block", transform },
    ], connections: [], controlBindings: [] });
    const connection = { id: "c", a: { partId: "a", socketId: "left" }, b: { partId: "b", socketId: "right" }, joint: { type: "fixed" as const } };
    expect(machine.connectParts(connection).ok).toBe(true);
    const before = machine.blueprint;
    expect(machine.connectParts({ ...connection, id: "c2" }).ok).toBe(false);
    expect(machine.blueprint).toEqual(before);
  });

  it("rolls back an atomic placement when connection or binding validation fails", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "a", definitionId: "block", transform }], connections: [], controlBindings: [] });
    const before = machine.blueprint;
    expect(machine.placeAndConnect({
      part: { id: "b", definitionId: "wheel", transform },
      connection: { id: "bad-placement", a: { partId: "a", socketId: "missing" }, b: { partId: "b", socketId: "axle" }, joint: { type: "revolute", axis: [1, 0, 0] } },
      bindings: [{ id: "b-drive", action: "drive", partId: "b", capability: "motor" }],
    })).toMatchObject({ ok: false, error: { code: "building.socket.not-found" } });
    expect(machine.blueprint).toEqual(before);
  });

  it("rejects self-connections and non-finite transforms", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "a", definitionId: "block", transform }], connections: [], controlBindings: [] });
    expect(machine.connectParts({ id: "self", a: { partId: "a", socketId: "left" }, b: { partId: "a", socketId: "right" }, joint: { type: "fixed" } })).toMatchObject({ ok: false, error: { code: "building.connection.self-connection" } });
    expect(machine.movePart("a", { position: [Number.NaN, 0, 0], rotation: [0, 0, 0] })).toMatchObject({ ok: false, error: { code: "building.transform.invalid" } });
  });

  it("rejects sockets with incompatible tags", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "a", definitionId: "block", transform }, { id: "b", definitionId: "incompatible", transform }], connections: [], controlBindings: [] });
    expect(machine.connectParts({ id: "bad", a: { partId: "a", socketId: "left" }, b: { partId: "b", socketId: "foreign" }, joint: { type: "fixed" } })).toMatchObject({ ok: false, error: { code: "building.socket.incompatible" } });
  });

  it("rejects unknown definitions and socket references", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [], connections: [], controlBindings: [] });
    expect(machine.addPart({ id: "missing", definitionId: "unknown", transform })).toMatchObject({ ok: false, error: { code: "building.part.definition-not-found" } });
    const withPart = restore({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "a", definitionId: "block", transform }, { id: "b", definitionId: "block", transform }], connections: [], controlBindings: [] });
    expect(withPart.connectParts({ id: "missing-socket", a: { partId: "a", socketId: "nope" }, b: { partId: "b", socketId: "right" }, joint: { type: "fixed" } })).toMatchObject({ ok: false, error: { code: "building.socket.not-found" } });
  });

  it("configures parts and binds only declared capabilities", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [{ id: "wheel", definitionId: "wheel", transform }], connections: [], controlBindings: [] });
    expect(machine.configurePart("wheel", { torque: 10 }).ok).toBe(true);
    expect(machine.bindControl({ id: "drive", action: "drive", partId: "wheel", capability: "motor" }).ok).toBe(true);
    expect(machine.bindControl({ id: "drive-duplicate", action: "drive", partId: "wheel", capability: "motor" })).toMatchObject({ ok: false, error: { code: "building.control.duplicate-target" } });
    expect(machine.bindControl({ id: "bad", action: "drive", partId: "wheel", capability: "steering" })).toMatchObject({ ok: false, error: { code: "building.control.capability-not-found" } });
    expect(machine.configurePart("wheel", { torque: 200 })).toMatchObject({ ok: false, error: { code: "building.part.configuration-invalid" } });
    expect(machine.configurePart("wheel", { unknown: true })).toMatchObject({ ok: false, error: { code: "building.part.configuration-invalid" } });
  });

  it("cascades connections and bindings when removing a part", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [
      { id: "a", definitionId: "block", transform },
      { id: "b", definitionId: "wheel", transform },
    ], connections: [{ id: "c", a: { partId: "a", socketId: "left" }, b: { partId: "b", socketId: "axle" }, joint: { type: "fixed" } }], controlBindings: [{ id: "bind", action: "forward", partId: "b", capability: "motor" }] });
    expect(machine.removePart("b").ok).toBe(true);
    expect(machine.blueprint.parts).toHaveLength(1);
    expect(machine.blueprint.connections).toHaveLength(0);
    expect(machine.blueprint.controlBindings).toHaveLength(0);
  });

  it("guards mutation while running simulation", () => {
    const machine = restore({ schemaVersion: 1, id: "m", version: 0, parts: [], connections: [], controlBindings: [] });
    machine.setMode("Simulation");
    const result = machine.addPart({ id: "a", definitionId: "block", transform });
    expect(result).toEqual({ ok: false, error: { code: "building.mode.invalid" } });
  });
});
