import type { MachineBlueprint } from "../../building/domain/contracts";
import type { AssemblyStep, BOMItem, HintTier, ParentInsightsReport, PhysicsDiagnosis, RealWorldCheckItem, SocraticHint, TelemetrySnapshot } from "../domain/contracts";
import { PhysicsDiagnosticsEngine } from "../domain/physics-diagnostics";
import { SocraticTutorEngine } from "../domain/socratic-tutor";
import { AssemblyGuideGenerator } from "../domain/assembly-guide-generator";
import { ParentInsightsEvaluator } from "../domain/parent-insights-evaluator";

export interface AICompanionState {
  readonly currentChallengeId: string;
  readonly currentDiagnosis: PhysicsDiagnosis | undefined;
  readonly currentHints: readonly SocraticHint[];
  readonly activeHintTier: HintTier;
  readonly highestTierUnlocked: HintTier;
  readonly attemptCount: number;
  readonly isWidgetOpen: boolean;
  readonly isCelebration: boolean;
  readonly celebrationMessage?: string | undefined;
  readonly showBuildModal: boolean;
  readonly activeModalTab: "build" | "parent";
}

export type AICompanionListener = (state: AICompanionState) => void;

export class AICompanionService {
  private readonly diagnostics = new PhysicsDiagnosticsEngine();
  private readonly tutor = new SocraticTutorEngine();
  private readonly guide = new AssemblyGuideGenerator();
  private readonly parentEvaluator = new ParentInsightsEvaluator();

  private state: AICompanionState = {
    currentChallengeId: "straight-dash",
    currentDiagnosis: undefined,
    currentHints: [],
    activeHintTier: 1,
    highestTierUnlocked: 1,
    attemptCount: 1,
    isWidgetOpen: false,
    isCelebration: false,
    showBuildModal: false,
    activeModalTab: "build",
  };

  private readonly listeners = new Set<AICompanionListener>();
  private lastDiagnosedKind: string | undefined = undefined;

  public subscribe(listener: AICompanionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  public setChallenge(challengeId: string): void {
    const hints = this.tutor.getHints(challengeId, "UNKNOWN");
    this.lastDiagnosedKind = undefined;
    this.state = {
      ...this.state,
      currentChallengeId: challengeId,
      currentDiagnosis: undefined,
      currentHints: hints,
      activeHintTier: 1,
      highestTierUnlocked: 1,
      isWidgetOpen: false,
      isCelebration: false,
      celebrationMessage: undefined,
    };
    this.notify();
  }

  public recordAttemptStart(challengeId: string): void {
    this.lastDiagnosedKind = undefined;
    this.state = {
      ...this.state,
      currentChallengeId: challengeId,
      currentDiagnosis: undefined,
      attemptCount: this.state.attemptCount + 1,
      isCelebration: false,
    };
    this.notify();
  }

  public processTelemetry(snapshot: TelemetrySnapshot, blueprint: MachineBlueprint): void {
    if (this.state.isCelebration) return;

    const diagnosis = this.diagnostics.diagnose(snapshot, blueprint);
    if (diagnosis.kind !== "UNKNOWN" && diagnosis.kind !== this.lastDiagnosedKind) {
      this.lastDiagnosedKind = diagnosis.kind;
      const hints = this.tutor.getHints(snapshot.challengeId, diagnosis.kind);
      // When a problem is diagnosed, start at Tier 2 (Socratic Question) to engage student curiosity!
      this.state = {
        ...this.state,
        currentDiagnosis: diagnosis,
        currentHints: hints,
        activeHintTier: 2,
        highestTierUnlocked: Math.max(this.state.highestTierUnlocked, 2) as HintTier,
        isWidgetOpen: true, // Automatically pop open speech bubble with Socratic question!
      };
      this.notify();
    }
  }

  public setHintTier(tier: HintTier): void {
    this.state = {
      ...this.state,
      activeHintTier: tier,
      highestTierUnlocked: Math.max(this.state.highestTierUnlocked, tier) as HintTier,
    };
    this.notify();
  }

  public unlockNextTier(): void {
    const next = Math.min(5, this.state.activeHintTier + 1) as HintTier;
    this.setHintTier(next);
  }

  public triggerCelebration(challengeTitle: string): void {
    this.state = {
      ...this.state,
      isCelebration: true,
      isWidgetOpen: true,
      celebrationMessage: `Tuyệt đỉnh! Em đã vượt qua thử thách "${challengeTitle}" xuất sắc! Hãy bấm "Lắp Ráp Ra Đời Thật" để xem cẩm nang chế tạo bộ kit thật nhé! 🎉⭐`,
    };
    this.notify();
  }

  public toggleWidget(open?: boolean): void {
    this.state = {
      ...this.state,
      isWidgetOpen: open ?? !this.state.isWidgetOpen,
    };
    this.notify();
  }

  public openBuildModal(tab: "build" | "parent" = "build"): void {
    this.state = {
      ...this.state,
      showBuildModal: true,
      activeModalTab: tab,
    };
    this.notify();
  }

  public closeBuildModal(): void {
    this.state = {
      ...this.state,
      showBuildModal: false,
    };
    this.notify();
  }

  public setModalTab(tab: "build" | "parent"): void {
    this.state = {
      ...this.state,
      activeModalTab: tab,
    };
    this.notify();
  }

  public getBOM(blueprint: MachineBlueprint): readonly BOMItem[] {
    return this.guide.generateBOM(blueprint);
  }

  public getAssemblySteps(blueprint: MachineBlueprint): readonly AssemblyStep[] {
    return this.guide.generateAssemblySteps(blueprint);
  }

  public getRealWorldChecklist(challengeId: string): readonly RealWorldCheckItem[] {
    return this.guide.generateRealWorldChecklist(challengeId);
  }

  public getParentReport(challengeTitle: string): ParentInsightsReport {
    return this.parentEvaluator.evaluate(
      this.state.currentChallengeId,
      challengeTitle,
      this.state.attemptCount,
      this.state.highestTierUnlocked
    );
  }

  public getState(): AICompanionState {
    return this.state;
  }
}
