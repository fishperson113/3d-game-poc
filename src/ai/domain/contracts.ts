export type PhysicsDiagnosisKind =
  | "HIGH_CENTERED"
  | "INSUFFICIENT_TORQUE"
  | "KNIFE_EDGE_OVERHANG"
  | "UNSTABLE_ROLLOVER"
  | "SHORT_WHEELBASE_VOID"
  | "CLEAR_PASS"
  | "UNKNOWN";

export interface TelemetrySnapshot {
  readonly position: readonly [number, number, number];
  readonly linearVelocity?: readonly [number, number, number] | undefined;
  readonly rotation?: readonly [number, number, number, number] | undefined;
  readonly elapsedSeconds: number;
  readonly throttle: number;
  readonly steering: number;
  readonly challengeId: string;
}

export interface PhysicsDiagnosis {
  readonly kind: PhysicsDiagnosisKind;
  readonly confidence: number; // 0 to 1
  readonly title: string;
  readonly description: string;
  readonly detectedAtSecond: number;
}

export type HintTier = 1 | 2 | 3 | 4 | 5;

export interface SocraticHint {
  readonly tier: HintTier;
  readonly tierLabel: string;
  readonly category: "reminder" | "socratic_question" | "focus_area" | "stem_principle" | "actionable_step";
  readonly title: string;
  readonly content: string;
  readonly stemPrinciple?: string;
  readonly actionPrompt?: string;
}

export interface BOMItem {
  readonly definitionId: string;
  readonly label: string;
  readonly icon: string;
  readonly count: number;
  readonly description: string;
}

export interface AssemblyStep {
  readonly stepNumber: number;
  readonly title: string;
  readonly icon: string;
  readonly instruction: string;
  readonly partsInvolved: readonly string[];
  readonly tip: string;
}

export interface RealWorldCheckItem {
  readonly id: string;
  readonly question: string;
  readonly guidance: string;
  readonly stemConcept: string;
}

export interface ParentInsightsReport {
  readonly challengeId: string;
  readonly challengeTitle: string;
  readonly attemptCount: number;
  readonly highestTierUsed: HintTier;
  readonly autonomyScorePercent: number; // 0 to 100%
  readonly masteredConcepts: readonly string[];
  readonly qualitativeFeedback: string;
  readonly parentDiscussionPrompt: string;
}
