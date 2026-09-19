import { describe, expect, it } from "vitest";
import { STEM_CHALLENGES } from "./challenges-data";

describe("STEM Challenges Data", () => {
  it("contains 6 valid STEM challenges in sequential order", () => {
    expect(STEM_CHALLENGES).toHaveLength(6);
    STEM_CHALLENGES.forEach((challenge, index) => {
      expect(challenge.number).toBe(index + 1);
      expect(challenge.id).toBeTruthy();
      expect(challenge.title).toBeTruthy();
      expect(challenge.subtitle).toBeTruthy();
      expect(challenge.stemTip).toBeTruthy();
      expect(challenge.mission.context).toBeTruthy();
      expect(challenge.mission.objective).toBeTruthy();
      expect(challenge.mission.route).toHaveLength(2);
      expect(challenge.mission.rules).toHaveLength(3);
      expect(challenge.mission.success).toBeTruthy();
      expect(challenge.targetTimeSeconds).toBeGreaterThan(0);
      expect(challenge.environment.spawn).toHaveLength(3);
      expect(challenge.environment.ground).toBeDefined();
    });
  });

  it("defines proper goal zones for all challenges", () => {
    for (const challenge of STEM_CHALLENGES) {
      expect(challenge.environment.goalZone).toBeDefined();
      expect(challenge.environment.goalZone?.position).toHaveLength(3);
      expect(challenge.environment.goalZone?.size).toHaveLength(3);
    }
  });

  it("configures specific challenge obstacles correctly", () => {
    // Stage 2: The Gap
    const gap = STEM_CHALLENGES.find((c) => c.id === "the-gap");
    expect(gap).toBeDefined();
    expect(gap?.environment.obstacles?.some((o) => o.id === "far-cliff")).toBe(true);

    // Stage 3: Step Up Wall
    const stepUp = STEM_CHALLENGES.find((c) => c.id === "step-up");
    expect(stepUp).toBeDefined();
    expect(stepUp?.environment.obstacles?.some((o) => o.id === "wall-step")).toBe(true);

    // Stage 4: V-Trench
    const trench = STEM_CHALLENGES.find((c) => c.id === "v-trench");
    expect(trench).toBeDefined();
    expect(trench?.environment.obstacles?.some((o) => o.id === "down-slope")).toBe(true);

    // Stage 5: High Centering Peak
    const peak = STEM_CHALLENGES.find((c) => c.id === "high-peak");
    expect(peak).toBeDefined();
    expect(peak?.environment.obstacles?.some((o) => o.id.startsWith("peak"))).toBe(true);

    // Stage 6: Bumpy Road
    const bumpy = STEM_CHALLENGES.find((c) => c.id === "bumpy-road");
    expect(bumpy).toBeDefined();
    expect(bumpy?.environment.obstacles?.some((o) => o.id.startsWith("bump"))).toBe(true);
  });
});
