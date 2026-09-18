import type { Vector3Tuple } from "../../kernel/math";
import type { ChallengeDefinition } from "./contracts";

export type ChallengeStatus = "pending" | "running" | "completed" | "failed";

export interface EvaluationSnapshot {
  readonly status: ChallengeStatus;
  readonly distanceToGoal: number;
  readonly elapsedSeconds: number;
  readonly stars: number;
  readonly message?: string;
}

export class RealtimeChallengeEvaluator {
  private status: ChallengeStatus = "pending";
  private elapsedSeconds = 0;

  public constructor(private readonly challenge: ChallengeDefinition) {}

  public reset(): void {
    this.status = "pending";
    this.elapsedSeconds = 0;
  }

  public start(): void {
    this.status = "running";
    this.elapsedSeconds = 0;
  }

  public step(deltaSeconds: number, rootPosition: Vector3Tuple | undefined): EvaluationSnapshot {
    if (this.status !== "running" || rootPosition === undefined) {
      return {
        status: this.status,
        distanceToGoal: 0,
        elapsedSeconds: this.elapsedSeconds,
        stars: 0,
      };
    }

    this.elapsedSeconds += deltaSeconds;

    if (this.challenge.maxTimeSeconds !== undefined && this.elapsedSeconds >= this.challenge.maxTimeSeconds) {
      this.status = "failed";
      return {
        status: "failed",
        distanceToGoal: 999,
        elapsedSeconds: this.elapsedSeconds,
        stars: 0,
        message: "Hết 60 giây. Mình xem lại kết quả rồi thử Version tiếp theo nhé.",
      };
    }

    const failThresholdY = this.challenge.failThresholdY ?? -2.2;
    if (rootPosition[1] < failThresholdY) {
      this.status = "failed";
      return {
        status: "failed",
        distanceToGoal: 999,
        elapsedSeconds: this.elapsedSeconds,
        stars: 0,
        message: "Ối! Xe bị rơi khỏi mặt đường rồi. Hãy thử chỉnh lại xe xem sao nhé!",
      };
    }

    const goal = this.challenge.environment.goalZone;
    if (goal === undefined) {
      return {
        status: "running",
        distanceToGoal: 0,
        elapsedSeconds: this.elapsedSeconds,
        stars: 1,
      };
    }

    const dx = rootPosition[0] - goal.position[0];
    const dz = rootPosition[2] - goal.position[2];
    const distanceToGoal = Math.hypot(dx, dz);

    const halfW = goal.size[0] / 2;
    const halfL = goal.size[2] / 2;
    const targetHalfExtents = this.challenge.targetHalfExtents ?? [0, 0, 0];

    const inGoalZone =
      Math.abs(dx) + targetHalfExtents[0] <= halfW &&
      Math.abs(dz) + targetHalfExtents[2] <= halfL &&
      Math.abs(rootPosition[1] - goal.position[1]) + targetHalfExtents[1] <= 1.8;

    if (inGoalZone) {
      this.status = "completed";
      let stars = 1;
      if (this.elapsedSeconds <= this.challenge.targetTimeSeconds) {
        stars = 3;
      } else if (this.elapsedSeconds <= this.challenge.targetTimeSeconds * 1.6) {
        stars = 2;
      }
      return {
        status: "completed",
        distanceToGoal: 0,
        elapsedSeconds: this.elapsedSeconds,
        stars,
        message: `Xuất sắc! Bạn đã về đích trong ${this.elapsedSeconds.toFixed(1)}s!`,
      };
    }

    return {
      status: "running",
      distanceToGoal,
      elapsedSeconds: this.elapsedSeconds,
      stars: 0,
    };
  }
}

