import { describe, expect, it } from "vitest";
import { RealtimeChallengeEvaluator } from "./challenge-evaluator";
import { STEM_CHALLENGES } from "./challenges-data";

describe("RealtimeChallengeEvaluator", () => {
  const warmup = STEM_CHALLENGES[0];
  const gap = STEM_CHALLENGES[1];
  if (warmup === undefined || gap === undefined) throw new Error("Missing challenges");

  it("evaluates pending status before starting", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    const snap = evaluator.step(0.1, [0, 0.5, 0]);
    expect(snap.status).toBe("pending");
    expect(snap.elapsedSeconds).toBe(0);
  });

  it("tracks elapsed time and distance to goal when running", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    evaluator.start();

    // Far from goal (z = -5, goal is at z = 10)
    const snap1 = evaluator.step(1.0, [0, 0.5, -5]);
    expect(snap1.status).toBe("running");
    expect(snap1.elapsedSeconds).toBe(1.0);
    expect(snap1.distanceToGoal).toBeGreaterThan(10);
  });

  it("awards 3 stars when reaching goal within target time", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    evaluator.start();

    // Reach goal at [0, 0.5, 10] in 5 seconds (target is 10s)
    const goalPos: [number, number, number] = [0, 0.5, 10];
    const snap = evaluator.step(5.0, goalPos);
    expect(snap.status).toBe("completed");
    expect(snap.stars).toBe(3);
    expect(snap.message).toContain("Xuất sắc!");
  });

  it("awards 2 stars when reaching goal slightly above target time", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    evaluator.start();

    // 10s * 1.6 = 16s. Let's finish at 12 seconds.
    const goalPos: [number, number, number] = [0, 0.5, 10];
    const snap = evaluator.step(12.0, goalPos);
    expect(snap.status).toBe("completed");
    expect(snap.stars).toBe(2);
  });

  it("awards 1 star when taking longer than 1.6x target time", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    evaluator.start();

    // Beyond 16 seconds
    const goalPos: [number, number, number] = [0, 0.5, 10];
    const snap = evaluator.step(20.0, goalPos);
    expect(snap.status).toBe("completed");
    expect(snap.stars).toBe(1);
  });

  it("detects falling into the abyss (y < -2.2)", () => {
    const evaluator = new RealtimeChallengeEvaluator(gap);
    evaluator.start();

    const fallenPos: [number, number, number] = [0, -2.5, 5];
    const snap = evaluator.step(1.0, fallenPos);
    expect(snap.status).toBe("failed");
    expect(snap.message).toContain("rơi khỏi mặt đường");
  });

  it("requires the whole Supply Pod to fit in the Rescue Zone", () => {
    const evaluator = new RealtimeChallengeEvaluator(gap);
    evaluator.start();
    const nearEdge = evaluator.step(1, [2.2, 0.5, 9.5]);
    expect(nearEdge.status).toBe("running");
    const centeredEvaluator = new RealtimeChallengeEvaluator(gap);
    centeredEvaluator.start();
    expect(centeredEvaluator.step(1, [0, 0.5, 9.5]).status).toBe("completed");
  });

  it("ends the Supply Pod test after 60 seconds", () => {
    const evaluator = new RealtimeChallengeEvaluator(gap);
    evaluator.start();
    const timedOut = evaluator.step(60, [0, 0.5, -8]);
    expect(timedOut.status).toBe("failed");
    expect(timedOut.message).toContain("60 giây");
  });

  it("resets state back to pending", () => {
    const evaluator = new RealtimeChallengeEvaluator(warmup);
    evaluator.start();
    evaluator.step(3.0, [0, 0.5, 5]);
    evaluator.reset();
    const snap = evaluator.step(0.1, [0, 0.5, 5]);
    expect(snap.status).toBe("pending");
    expect(snap.elapsedSeconds).toBe(0);
  });
});
