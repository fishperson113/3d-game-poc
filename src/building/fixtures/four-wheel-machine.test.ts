import { describe, expect, it } from "vitest";
import { FourWheelFixtureCatalog } from "./four-wheel-catalog";
import { createFourWheelMachineFixture } from "./four-wheel-machine";

describe("four-wheel machine fixture", () => {
  it("builds a stable connected vehicle graph", () => {
    const result = createFourWheelMachineFixture(new FourWheelFixtureCatalog());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts).toHaveLength(7);
    expect(result.value.connections).toHaveLength(6);
    expect(result.value.controlBindings).toHaveLength(6);
    expect(result.value.connections.filter((connection) => connection.id.startsWith("mount-front")).every((connection) => connection.joint.axis !== undefined && connection.joint.axis[1] === 1 && connection.joint.limits !== undefined && connection.joint.limits[0] === -0.6 && connection.joint.limits[1] === 0.6)).toBe(true);
    expect(result.value.connections.filter((connection) => connection.id.startsWith("steer-front")).every((connection) => connection.joint.axis !== undefined && connection.joint.axis[0] === 1 && connection.joint.axis[1] === 0)).toBe(true);
    expect(result.value.parts.map((part) => part.id)).toEqual([
      "chassis", "hinge-front-left", "hinge-front-right", "wheel-front-left", "wheel-front-right", "wheel-rear-left", "wheel-rear-right",
    ]);
    const second = createFourWheelMachineFixture(new FourWheelFixtureCatalog());
    expect(second).toEqual(result);
  });
});
