import type { EventEnvelope } from "../../kernel/events/contracts";

export type ChallengeStatus = "pending" | "running" | "completed" | "failed";

export interface ChallengeEvaluator {
  readonly status: ChallengeStatus;
  observe(event: EventEnvelope): ChallengeStatus;
}

// TODO(plan-03): Implement enter-trigger, timeout and reset evaluators.
