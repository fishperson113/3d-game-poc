import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP_SECONDS } from "./runtime-contract";

describe("runtime contract", () => {
  it("uses a fixed 60 Hz simulation step", () => {
    expect(FIXED_TIMESTEP_SECONDS).toBe(1 / 60);
  });
});
