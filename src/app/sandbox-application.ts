import type { MachineBlueprint } from "../building/domain/contracts";
import { createPlacementPreview, findPlacementCandidates, rotatePlacementCandidate, rootTransform, validatePlacementCandidate, type AssemblyPlacementCandidate } from "../building";
import { createRuntimeSampleFixture, RUNTIME_SAMPLES, serializePhysicsSpecification, type RuntimeSampleId, type SimulationSession } from "../simulation";
import { ThreeSimulationRenderer } from "../adapters/three/three-simulation-renderer";
import { KeyboardInputSource, RapierPhysicsWorld } from "../adapters";
import { AppView, type AppViewModel } from "./ui/app-view";
import type { ApplicationComposition } from "./composition-root";
import type { RuntimeState } from "../kernel/runtime-contract";
import type { TransformSnapshot } from "../kernel/math";
import { STEM_CHALLENGES, RealtimeChallengeEvaluator, type ChallengeDefinition, type ChallengeProgress } from "../challenge";
import { soundEffects } from "./audio/sound-effects";
import { AICompanionService, AITutorWidget, DigitalToPhysicalModal } from "../ai";

interface PlacementState {
  readonly definitionId: string;
  readonly partId: string;
  readonly candidates: readonly AssemblyPlacementCandidate[];
  readonly candidateIndex: number;
  readonly rotationSteps: number;
}

interface SupplyAttempt {
  readonly version: 1 | 2;
  readonly completed: boolean;
  readonly elapsedSeconds: number;
  readonly distanceCm: number;
  readonly stable: boolean;
  readonly touchedFlood: boolean;
  readonly partCount: number;
}

interface SupplyMissionState {
  stage: "briefing" | "plan" | "build-v1" | "review-v1" | "build-v2" | "reflection" | "report";
  showModal: boolean;
  attempts: SupplyAttempt[];
  plan?: string;
  predictionSeconds?: number;
  risk?: string;
  variableChanged?: string;
  variableReason?: string;
  reflection?: string;
  adultHelp?: boolean;
}

interface ActiveSupplyAttempt {
  readonly version: 1 | 2;
  maxDistanceCm: number;
  elapsedSeconds: number;
  stable: boolean;
  touchedFlood: boolean;
}

export class SandboxApplication {
  private readonly view: AppView;
  private readonly renderer: ThreeSimulationRenderer;
  private blueprint: MachineBlueprint = { schemaVersion: 1, id: "sandbox-machine" as MachineBlueprint["id"], version: 0, parts: [], connections: [], controlBindings: [] };
  private state: RuntimeState = "LoadingChallenge";
  private selectedPartId: string | undefined;
  private placement: PlacementState | undefined;
  private selectedSampleId: RuntimeSampleId = "four-wheel-scout";
  private feedback: AppViewModel["feedback"] = { tone: "neutral", message: "Đang khởi động phòng thí nghiệm STEM…" };
  private readonly variants: Record<string, string> = { "core.structural-block": "A", "core.powered-wheel": "A", "core.steering-hinge": "A" };
  private eventFilter = "";
  private session: SimulationSession | undefined;
  private lastFrameTime = 0;
  private rafId: number | undefined;
  private simulationLockHeld = false;
  private recovering = false;
  private rendererReady = true;
  private pendingFrameFault: Error | undefined;
  private pendingReleaseFailures = 0;

  // Gamification & Challenge state
  private readonly challenges: readonly ChallengeDefinition[] = STEM_CHALLENGES;
  private currentChallengeId = "warmup";
  private challengeProgress: Record<string, ChallengeProgress> = {};
  private evaluator: RealtimeChallengeEvaluator;
  private gameMode: "campaign" | "creative" = "campaign";
  private victoryState: { stars: number; timeSeconds: number; message: string } | undefined;
  private failState: { message: string; stemTip: string } | undefined;
  private showWelcomeModal = true;
  private showChallengeModal = false;
  private showChallengeBriefingModal = false;
  private showAdvancedPanel = false;
  private supplyMission: SupplyMissionState = { stage: "briefing", showModal: false, attempts: [] };
  private activeSupplyAttempt: ActiveSupplyAttempt | undefined;

  // AI Companion & Digital-to-Physical bridge
  private readonly aiService: AICompanionService;
  private readonly aiTutorWidget: AITutorWidget;
  private readonly digitalToPhysicalModal: DigitalToPhysicalModal;
  private lastRootPos: readonly [number, number, number] | undefined;

  private readonly onTestFault = (event: Event): void => {
    const detail = (event as CustomEvent<{ phase?: string }>).detail;
    if (detail.phase === "frame") this.pendingFrameFault = new Error("test.injected-frame-failure");
    if (detail.phase === "release") this.pendingReleaseFailures += 1;
  };
  private disposed = false;
  private readonly unsubscribeLog: () => void;

  private getCurrentChallenge(): ChallengeDefinition {
    const found = this.challenges.find((c) => c.id === this.currentChallengeId);
    if (found !== undefined) return found;
    const first = this.challenges[0];
    if (first !== undefined) return first;
    const fallback = STEM_CHALLENGES[0];
    if (fallback !== undefined) return fallback;
    throw new Error("No challenges available");
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const actionElement = target?.closest<HTMLElement>("[data-action]");
    if (actionElement === null || actionElement === undefined) return;
    const action = actionElement.dataset.action;
    if (action === undefined) return;

    if (action === "palette") {
      soundEffects.playClick();
      void this.beginPlacement(actionElement.dataset.partId).catch((error: unknown) => { this.reject(error instanceof Error ? error.message : String(error)); });
    } else if (action === "start") {
      soundEffects.playClick();
      void this.start();
    } else if (action === "retry") {
      soundEffects.playClick();
      void this.retry();
    } else if (action === "stop" || action === "reset") {
      soundEffects.playClick();
      void this.stopAndReset();
    } else if (action === "sample") {
      soundEffects.playClick();
      void this.loadSample();
    } else if (action === "confirm-placement") {
      void this.confirmPlacement();
    } else if (action === "cancel-placement") {
      soundEffects.playClick();
      this.cancelPlacement();
    } else if (action === "next-socket") {
      soundEffects.playClick();
      this.changeCandidate(1);
    } else if (action === "previous-socket") {
      soundEffects.playClick();
      this.changeCandidate(-1);
    } else if (action === "rotate-placement") {
      soundEffects.playClick();
      this.rotatePlacement();
    } else if (action === "rotate-selected") {
      soundEffects.playClick();
      void this.rotateSelected();
    } else if (action === "delete-selected") {
      soundEffects.playClick();
      void this.deleteSelected();
    } else if (action === "clear-selection") {
      soundEffects.playClick();
      this.selectedPartId = undefined;
      this.renderer.setSelection(undefined);
      this.refreshView();
    } else if (action === "disconnect") {
      soundEffects.playClick();
      void this.disconnect(actionElement.dataset.connectionId);
    } else if (action === "export") {
      this.exportEvents();
    } else if (action === "open-welcome") {
      soundEffects.playClick();
      this.showWelcomeModal = true;
      this.refreshView();
    } else if (action === "close-welcome") {
      soundEffects.playClick();
      this.showWelcomeModal = false;
      if (this.currentChallengeId !== "the-gap") this.showChallengeBriefingModal = true;
      this.refreshView();
    } else if (action === "open-challenges") {
      soundEffects.playClick();
      this.showChallengeModal = true;
      this.refreshView();
    } else if (action === "close-challenges") {
      soundEffects.playClick();
      this.showChallengeModal = false;
      this.refreshView();
    } else if (action === "select-challenge") {
      const chId = actionElement.dataset.challengeId;
      if (chId !== undefined) void this.selectChallenge(chId);
    } else if (action === "toggle-sound") {
      soundEffects.toggleMute();
      this.refreshView();
    } else if (action === "toggle-advanced") {
      soundEffects.playClick();
      this.showAdvancedPanel = !this.showAdvancedPanel;
      this.refreshView();
    } else if (action === "reset-camera") {
      soundEffects.playClick();
      this.renderer.resetCamera();
    } else if (action === "close-victory") {
      soundEffects.playClick();
      this.victoryState = undefined;
      void this.stopAndReset();
    } else if (action === "close-fail") {
      soundEffects.playClick();
      this.failState = undefined;
      void this.stopAndReset();
    } else if (action === "next-level") {
      soundEffects.playClick();
      this.victoryState = undefined;
      const curIndex = this.challenges.findIndex((c) => c.id === this.currentChallengeId);
      const nextChallenge = this.challenges[(curIndex + 1) % this.challenges.length];
      if (nextChallenge !== undefined) void this.selectChallenge(nextChallenge.id);
    } else if (action === "open-build-modal") {
      soundEffects.playClick();
      this.aiService.openBuildModal("build");
    } else if (action === "open-parent-modal") {
      soundEffects.playClick();
      this.aiService.openBuildModal("parent");
    } else if (action === "open-challenge-build") {
      soundEffects.playClick();
      const chId = actionElement.dataset.challengeId;
      if (chId !== undefined) {
        this.aiService.setChallenge(chId);
        this.aiService.openBuildModal("build");
      }
    } else if (action === "open-challenge-parent") {
      soundEffects.playClick();
      const chId = actionElement.dataset.challengeId;
      if (chId !== undefined) {
        this.aiService.setChallenge(chId);
        this.aiService.openBuildModal("parent");
      }
    } else if (action === "mobile-open-parent-sample") {
      soundEffects.playClick();
      const mobileOverlay = this.host.querySelector<HTMLElement>("[data-role=mobile-fallback]");
      if (mobileOverlay) mobileOverlay.style.display = "none";
      this.aiService.openBuildModal("parent");
    } else if (action === "dismiss-mobile-fallback") {
      soundEffects.playClick();
      const mobileOverlay = this.host.querySelector<HTMLElement>("[data-role=mobile-fallback]");
      if (mobileOverlay) mobileOverlay.style.display = "none";
    } else if (action === "open-supply-mission") {
      if (this.currentChallengeId === "the-gap") this.supplyMission.showModal = true;
      else this.showChallengeBriefingModal = true;
      this.refreshView();
    } else if (action === "close-supply-mission") {
      this.supplyMission.showModal = false;
      this.refreshView();
    } else if (action === "close-challenge-briefing") {
      this.showChallengeBriefingModal = false;
      this.refreshView();
    } else if (action === "accept-supply-mission") {
      const understood = this.view.getElement("supply-mission-modal").querySelector<HTMLInputElement>('[data-role="mission-understood"]');
      if (understood?.checked !== true) { this.setMissionError("Đánh dấu ô xác nhận trước nhé."); return; }
      this.supplyMission.stage = "plan";
      this.refreshView();
    } else if (action === "save-supply-plan") {
      const plan = this.missionField("mission-plan");
      if (plan.length < 8) { this.setMissionError("Viết một câu ngắn về ý tưởng của con nhé."); return; }
      this.supplyMission.plan = plan;
      this.supplyMission.predictionSeconds = Number(this.missionField("mission-prediction"));
      this.supplyMission.risk = this.missionField("mission-risk");
      this.supplyMission.stage = "build-v1";
      this.supplyMission.showModal = false;
      this.saveSupplyMission();
      this.refreshView();
    } else if (action === "save-supply-variable") {
      const reason = this.missionField("mission-reason");
      if (reason.length < 8) { this.setMissionError("Nói ngắn gọn vì sao con chọn thay đổi này nhé."); return; }
      this.supplyMission.variableChanged = this.missionField("mission-variable");
      this.supplyMission.variableReason = reason;
      this.supplyMission.stage = "build-v2";
      this.supplyMission.showModal = false;
      this.saveSupplyMission();
      this.refreshView();
    } else if (action === "save-supply-reflection") {
      const reflection = this.missionField("mission-reflection");
      if (reflection.length < 12) { this.setMissionError("Dùng kết quả hai lần test để giải thích thêm một chút nhé."); return; }
      this.supplyMission.reflection = reflection;
      this.supplyMission.adultHelp = this.view.getElement("supply-mission-modal").querySelector<HTMLInputElement>('[data-role="mission-adult-help"]')?.checked === true;
      this.supplyMission.stage = "report";
      this.supplyMission.showModal = true;
      this.saveSupplyMission();
      this.refreshView();
    }
  };

  private missionField(role: string): string {
    const element = this.view.getElement("supply-mission-modal").querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-role="${role}"]`);
    return element?.value.trim() ?? "";
  }

  private setMissionError(message: string): void {
    const error = this.view.getElement("supply-mission-modal").querySelector<HTMLElement>('[data-role="mission-error"]');
    if (error !== null) error.textContent = message;
  }

  private readonly onPointerDownDrive = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    const driveBtn = target?.closest<HTMLElement>("[data-drive]");
    if (!driveBtn) return;
    const drive = driveBtn.dataset.drive;
    const input = this.session?.getInput();
    if (input && input instanceof KeyboardInputSource) {
      if (drive === "forward") input.setTouchThrottle(1);
      else if (drive === "backward") input.setTouchThrottle(-1);
      else if (drive === "left") input.setTouchSteering(1);
      else if (drive === "right") input.setTouchSteering(-1);
    }
  };

  private readonly onPointerUpDrive = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    const driveBtn = target?.closest<HTMLElement>("[data-drive]");
    if (!driveBtn) return;
    const drive = driveBtn.dataset.drive;
    const input = this.session?.getInput();
    if (input && input instanceof KeyboardInputSource) {
      if (drive === "forward" || drive === "backward") input.setTouchThrottle(0);
      if (drive === "left" || drive === "right") input.setTouchSteering(0);
    }
  };

  private readonly onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (target?.dataset.action === "sample-select") {
      const selected = RUNTIME_SAMPLES.find((sample) => sample.id === target.value);
      if (selected === undefined) return;
      this.selectedSampleId = selected.id;
      void this.loadSample();
      return;
    }
    if (target?.dataset.action !== "variant" || target.dataset.partId === undefined) return;
    this.variants[target.dataset.partId] = target.value;
    this.renderer.setBlueprint(this.blueprint, this.composition.catalog, this.variants);
    this.renderer.setSelection(this.selectedPartId);
    this.feedback = { tone: "good", message: `Đã chọn kiểu hiển thị ${target.value}.` };
    this.refreshView();
  };

  private readonly onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    if (target?.dataset.role !== "event-filter") return;
    this.eventFilter = target.value;
    this.refreshView();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable === true) return;
    if (this.state !== "Building") return;
    if (event.code === "Escape") { this.cancelPlacement(); event.preventDefault(); }
    if (event.code === "KeyR" && this.placement !== undefined) { this.rotatePlacement(); event.preventDefault(); }
    if (event.code === "Delete" && this.selectedPartId !== undefined) { void this.deleteSelected(); event.preventDefault(); }
  };

  private readonly onPick = (partId: string): void => {
    if (this.state !== "Building") return;
    this.selectedPartId = partId;
    this.renderer.setSelection(partId);
    soundEffects.playClick();
    this.refreshView();
  };

  private readonly onFrame = (time: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.onFrame);
    if (document.hidden) {
      this.lastFrameTime = 0;
      return;
    }
    try {
      if (this.pendingFrameFault !== undefined) {
        const fault = this.pendingFrameFault;
        this.pendingFrameFault = undefined;
        throw fault;
      }
      const delta = this.lastFrameTime === 0 ? 0 : (time - this.lastFrameTime) / 1000;
      this.lastFrameTime = time;

      if (this.session !== undefined) {
        this.session.advance(delta);

        // Check victory or failure
        if (this.state === "Running") {
          const currentChallenge = this.getCurrentChallenge();
          const rootId = this.blueprint.parts[0]?.id;
          const transforms = this.renderer.getLastFrame()?.transforms;
          const rootTransform = rootId === undefined ? undefined : transforms?.[String(rootId)];
          const missionTransform = currentChallenge.environment.payload === undefined
            ? rootTransform
            : transforms?.[currentChallenge.environment.payload.id];
          const evaluation = this.evaluator.step(delta, missionTransform?.position);
          if (this.currentChallengeId === "the-gap" && missionTransform !== undefined) this.updateSupplyAttempt(missionTransform, evaluation.elapsedSeconds);

          if (evaluation.status === "completed") {
            if (this.currentChallengeId === "the-gap") {
              this.finishSupplyAttempt(true, evaluation.elapsedSeconds);
              soundEffects.playVictory();
              void this.stopAndReset();
              return;
            }
            soundEffects.playVictory();
            const current = currentChallenge;
            this.aiService.triggerCelebration(current.title);
            const existingStars = this.challengeProgress[current.id]?.stars ?? 0;
            this.challengeProgress[current.id] = {
              completed: true,
              stars: Math.max(existingStars, evaluation.stars),
              bestTimeSeconds: Math.min(this.challengeProgress[current.id]?.bestTimeSeconds ?? 999, evaluation.elapsedSeconds),
            };
            this.saveProgress();
            this.victoryState = {
              stars: evaluation.stars,
              timeSeconds: evaluation.elapsedSeconds,
              message: evaluation.message ?? "Bạn đã vượt qua thử thách thành công!",
            };
            void this.stopAndReset();
            return;
          } else if (evaluation.status === "failed") {
            if (this.currentChallengeId === "the-gap") {
              this.finishSupplyAttempt(false, evaluation.elapsedSeconds);
              soundEffects.playBoing();
              void this.stopAndReset();
              return;
            }
            soundEffects.playBoing();
            this.failState = {
              message: evaluation.message ?? "Xe đã bị rơi khỏi đường đua!",
              stemTip: this.getCurrentChallenge().stemTip,
            };
            void this.stopAndReset();
            return;
          }

          if (rootTransform !== undefined) {
            const controls = this.session.getLastControls();
            const pos = rootTransform.position;
            const rot = rootTransform.rotation;
            const linVel = this.lastRootPos
              ? ([
                  (pos[0] - this.lastRootPos[0]) / Math.max(delta, 0.001),
                  (pos[1] - this.lastRootPos[1]) / Math.max(delta, 0.001),
                  (pos[2] - this.lastRootPos[2]) / Math.max(delta, 0.001),
                ] as const)
              : undefined;
            this.lastRootPos = pos;

            this.aiService.processTelemetry(
              {
                position: pos,
                linearVelocity: linVel,
                rotation: rot,
                elapsedSeconds: evaluation.elapsedSeconds,
                throttle: controls.throttle,
                steering: controls.steering,
                challengeId: this.currentChallengeId,
              },
              this.blueprint
            );
          }

          // Sound update
          soundEffects.updateMotor(this.session.getLastControls().throttle);
        }
      } else {
        soundEffects.stopMotor();
      }

      if (this.logDirty && time - this.lastLogRefresh >= 150) {
        this.logDirty = false;
        this.lastLogRefresh = time;
        this.view.renderEvents(this.composition.memoryLog.snapshot(), this.eventFilter);
      }
      this.updatePhysicsDiagnostics();
    } catch (error) {
      void this.failRuntime(error, "frame");
    }
  };

  public constructor(private readonly host: HTMLElement, private readonly composition: ApplicationComposition, playerName?: string) {
    this.view = new AppView(host, playerName);
    this.renderer = new ThreeSimulationRenderer({
      onPick: this.onPick,
      onContextLost: (error) => { this.rendererReady = false; void this.failRuntime(error, "webgl-context-lost"); },
      onContextRestored: () => {
        this.rendererReady = true;
        this.composition.emit("renderer.webgl.context-restored", {}, "info");
        if (this.state === "Failed") {
          this.feedback = { tone: "neutral", message: "Đồ họa WebGL đã phục hồi. Bấm Thử Lại để tiếp tục." };
          this.refreshView();
        }
      },
    });
    this.renderer.mount(this.view.getElement("viewport"));

    // Load progress
    this.loadProgress();

    // Set initial environment
    const initialChallenge = this.getCurrentChallenge();
    this.renderer.setEnvironment(initialChallenge.environment);
    this.evaluator = new RealtimeChallengeEvaluator(initialChallenge);

    // Initialize AI Companion and widgets
    this.aiService = new AICompanionService();
    this.aiTutorWidget = new AITutorWidget(this.host, this.aiService, () => {
      this.aiService.openBuildModal("build");
    });
    this.digitalToPhysicalModal = new DigitalToPhysicalModal(
      this.host,
      this.aiService,
      () => this.blueprint,
      (chId) => this.challenges.find((c) => c.id === chId)?.title ?? this.getCurrentChallenge().title
    );
    this.aiService.setChallenge(initialChallenge.id);

    this.host.addEventListener("click", this.onClick);
    this.host.addEventListener("change", this.onChange);
    this.host.addEventListener("input", this.onInput);
    this.host.addEventListener("pointerdown", this.onPointerDownDrive);
    this.host.addEventListener("pointerup", this.onPointerUpDrive);
    this.host.addEventListener("pointercancel", this.onPointerUpDrive);
    this.host.addEventListener("sandbox:test-fault", this.onTestFault);
    window.addEventListener("keydown", this.onKeyDown);
    this.unsubscribeLog = this.composition.memoryLog.subscribe(() => { this.logDirty = true; });
    this.rafId = requestAnimationFrame(this.onFrame);
  }

  private logDirty = false;
  private lastLogRefresh = 0;

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem("stem_car_lab_progress");
      if (raw) {
        this.challengeProgress = JSON.parse(raw) as Record<string, ChallengeProgress>;
      }
      const missionRaw = localStorage.getItem("stem_supply_mission");
      if (missionRaw) this.supplyMission = { ...this.supplyMission, ...(JSON.parse(missionRaw) as SupplyMissionState), showModal: false };
    } catch { /* ignore storage errors */ }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem("stem_car_lab_progress", JSON.stringify(this.challengeProgress));
    } catch { /* ignore storage errors */ }
  }

  private saveSupplyMission(): void {
    try {
      localStorage.setItem("stem_supply_mission", JSON.stringify({ ...this.supplyMission, showModal: false }));
    } catch { /* ignore storage errors */ }
  }

  public async initialize(): Promise<void> {
    try {
      const created = await this.composition.building.create("sandbox-machine");
      if (!created.ok) throw new Error(created.error.code);
      await this.loadSample();
      this.state = "Building";
      this.feedback = { tone: "good", message: "Xưởng chế tạo sẵn sàng! Chiếc xe đã sẵn sàng tại vạch xuất phát." };
      this.refreshView();
    } catch (error) {
      this.feedback = { tone: "bad", message: `Khởi động thất bại: ${error instanceof Error ? error.message : String(error)}` };
      this.refreshView();
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.aiTutorWidget.dispose();
    this.digitalToPhysicalModal.dispose();
    soundEffects.stopMotor();
    window.removeEventListener("keydown", this.onKeyDown);
    this.host.removeEventListener("click", this.onClick);
    this.host.removeEventListener("change", this.onChange);
    this.host.removeEventListener("input", this.onInput);
    this.host.removeEventListener("pointerdown", this.onPointerDownDrive);
    this.host.removeEventListener("pointerup", this.onPointerUpDrive);
    this.host.removeEventListener("pointercancel", this.onPointerUpDrive);
    this.host.removeEventListener("sandbox:test-fault", this.onTestFault);
    this.unsubscribeLog();
    try { await this.cleanupSimulation(); } catch { /* Best-effort shutdown. */ }
    try { this.renderer.dispose(); } catch { /* Best-effort shutdown. */ }
  }

  public getBlueprint(): MachineBlueprint { return this.blueprint; }

  public async selectChallenge(challengeId: string): Promise<void> {
    if (this.state === "Running") await this.stopAndReset();
    this.currentChallengeId = challengeId;
    this.aiService.setChallenge(challengeId);
    this.showChallengeModal = false;
    const challenge = this.getCurrentChallenge();
    this.evaluator = new RealtimeChallengeEvaluator(challenge);
    this.renderer.setEnvironment(challenge.environment);
    if (challengeId === "the-gap" && this.supplyMission.attempts.length === 0 && (this.supplyMission.stage === "briefing" || this.supplyMission.stage === "plan")) {
      const blank: MachineBlueprint = { ...this.blueprint, version: this.blueprint.version + 1, parts: [], connections: [], controlBindings: [] };
      const replaced = await this.composition.building.replace("sandbox-machine", blank);
      if (!replaced.ok) throw new Error(replaced.error.code);
      this.blueprint = replaced.value;
      this.supplyMission.showModal = true;
    } else if (this.blueprint.parts.length === 0 && challenge.environment.payload === undefined) {
      await this.loadSample();
    }
    this.showChallengeBriefingModal = challengeId !== "the-gap";
    this.renderer.setBlueprint(this.blueprint, this.composition.catalog, this.variants);
    this.renderer.resetCamera();
    this.feedback = { tone: "good", message: `Đã nạp ${challenge.title}: ${challenge.subtitle}` };
    soundEffects.playClick();
    this.refreshView();
  }

  private async syncBlueprint(): Promise<void> {
    const loaded = await this.composition.building.load("sandbox-machine");
    if (!loaded.ok) throw new Error(loaded.error.code);
    this.blueprint = loaded.value;
    this.renderer.setBlueprint(this.blueprint, this.composition.catalog, this.variants);
    this.renderer.setSelection(this.selectedPartId);
    delete this.host.dataset.physicsRootPosition;
    delete this.host.dataset.physicsRootRotation;
    delete this.host.dataset.physicsControls;
    delete this.host.dataset.physicsTransforms;
    this.refreshView();
  }

  private generateUniquePartId(definitionId: string): string {
    const rawPrefix = definitionId.replace(/^core\./, "");
    const prefixMap: Record<string, string> = {
      "powered-wheel": "wheel",
      "drive-gear": "gear",
      "motor-module": "motor",
      "crawler-track": "track",
      "battery-box": "battery",
      "heavy-beam": "beam",
      "steering-hinge": "hinge",
      "structural-block": "chassis",
    };
    const prefix = prefixMap[rawPrefix] ?? rawPrefix.split("-")[0] ?? "part";
    const existingPartIds = new Set(this.blueprint.parts.map((part) => String(part.id)));
    const existingConnectionIds = new Set(this.blueprint.connections.map((c) => String(c.id)));
    const existingBindingIds = new Set(this.blueprint.controlBindings.map((b) => String(b.id)));
    let counter = 1;
    while (
      existingPartIds.has(`${prefix}-${String(counter)}`) ||
      existingConnectionIds.has(`${prefix}-${String(counter)}`) ||
      existingBindingIds.has(`${prefix}-${String(counter)}-drive`) ||
      existingBindingIds.has(`${prefix}-${String(counter)}-steer`)
    ) {
      counter++;
    }
    return `${prefix}-${String(counter)}`;
  }

  private async beginPlacement(definitionId: string | undefined): Promise<void> {
    if (this.state !== "Building" || definitionId === undefined) return;
    if (this.blueprint.parts.length === 0) {
      const partId = this.generateUniquePartId(definitionId);
      const added = await this.composition.building.addPart("sandbox-machine", { id: partId, definitionId, transform: rootTransform() });
      if (!added.ok) { this.reject(added.error.code); return; }
      this.selectedPartId = partId;
      await this.syncBlueprint();
      this.renderer.setSelection(this.selectedPartId);
      soundEffects.playSnap();
      this.feedback = { tone: "good", message: `Đã đặt ${partId} làm bệ đỡ trung tâm. Tiếp tục gắn thêm bánh xe hoặc khớp bẻ lái!` };
      this.refreshView();
      return;
    }
    const candidates = findPlacementCandidates(this.blueprint, definitionId, this.composition.catalog);
    if (candidates.length === 0) {
      this.feedback = { tone: "bad", message: "Không còn điểm nối tương thích nào còn trống cho linh kiện này." };
      this.refreshView();
      return;
    }
    const partId = this.generateUniquePartId(definitionId);
    this.placement = { definitionId, partId, candidates, candidateIndex: 0, rotationSteps: 0 };
    this.paintPlacement();
    this.feedback = { tone: "neutral", message: `Khối ảo màu xanh đã sẵn sàng. Hãy bấm 'Xác nhận gắn' khi điểm gắn sáng lên.` };
    this.refreshView();
  }

  private paintPlacement(): void {
    if (this.placement === undefined) { this.renderer.setGhost(undefined); this.renderer.setSocketHighlights([]); return; }
    const current = this.placement.candidates[this.placement.candidateIndex];
    if (current === undefined) return;
    const rotated = rotatePlacementCandidate(this.blueprint, this.placement.definitionId, current, this.composition.catalog, this.placement.rotationSteps);
    const validation = validatePlacementCandidate(this.blueprint, this.placement.definitionId, current, this.composition.catalog, this.placement.rotationSteps);
    this.renderer.setGhost({ partId: this.placement.partId, definitionId: this.placement.definitionId, transform: rotated.transform, valid: validation.valid });
    this.renderer.setSocketHighlights([`${current.targetPartId}::${current.targetSocketId}`]);
    if (!validation.valid) {
      this.feedback = { tone: "bad", message: `⚠️ ${validation.reason ?? "Vị trí hoặc hướng xoay không hợp lệ"}` };
    } else {
      this.feedback = { tone: "neutral", message: "Vị trí gắn hợp lệ! Hãy bấm 'Xác nhận gắn' (hoặc nhấn R để xoay)." };
    }
  }

  private changeCandidate(offset: number): void {
    if (this.placement === undefined) return;
    const length = this.placement.candidates.length;
    this.placement = { ...this.placement, candidateIndex: (this.placement.candidateIndex + offset + length) % length, rotationSteps: 0 };
    this.paintPlacement();
    this.refreshView();
  }

  private rotatePlacement(): void {
    if (this.placement === undefined) return;
    this.placement = { ...this.placement, rotationSteps: (this.placement.rotationSteps + 1) % 4 };
    this.paintPlacement();
    this.refreshView();
  }

  private cancelPlacement(): void {
    if (this.placement === undefined) return;
    this.placement = undefined;
    this.renderer.setGhost(undefined);
    this.renderer.setSocketHighlights([]);
    this.feedback = { tone: "neutral", message: "Đã hủy thao tác gắn; xe không thay đổi." };
    this.refreshView();
  }

  private async confirmPlacement(): Promise<void> {
    const placement = this.placement;
    if (placement === undefined || this.state !== "Building") return;
    const candidate = placement.candidates[placement.candidateIndex];
    if (candidate === undefined) return;
    const validation = validatePlacementCandidate(this.blueprint, placement.definitionId, candidate, this.composition.catalog, placement.rotationSteps);
    if (!validation.valid) {
      soundEffects.playBoing();
      this.feedback = { tone: "bad", message: `❌ Không thể gắn: ${validation.reason ?? "Vị trí không hợp lệ!"}` };
      this.refreshView();
      return;
    }
    const finalPartId = this.blueprint.parts.some((p) => String(p.id) === placement.partId)
      ? this.generateUniquePartId(placement.definitionId)
      : placement.partId;
    const rotated = rotatePlacementCandidate(this.blueprint, placement.definitionId, candidate, this.composition.catalog, placement.rotationSteps);
    const preview = createPlacementPreview(this.blueprint, placement.definitionId, finalPartId, rotated, this.composition.catalog);
    const placed = await this.composition.building.placeAndConnect("sandbox-machine", preview.placement);
    if (!placed.ok) { this.reject(placed.error.code); return; }
    this.placement = undefined;
    this.renderer.setGhost(undefined);
    await this.syncBlueprint();
    this.selectedPartId = preview.placement.part.id;
    this.renderer.setSelection(this.selectedPartId);
    soundEffects.playSnap();
    this.feedback = { tone: "good", message: `Đã gắn thành công ${preview.placement.part.id}!` };
    this.refreshView();
  }

  private async start(): Promise<void> {
    if (this.state !== "Building") return;
    if (!this.rendererReady) { this.reject("renderer.webgl-context-unavailable"); return; }
    if (this.currentChallengeId === "the-gap" && (this.supplyMission.stage === "briefing" || this.supplyMission.stage === "plan" || this.supplyMission.stage === "review-v1" || this.supplyMission.stage === "reflection" || this.supplyMission.stage === "report")) {
      this.supplyMission.showModal = true;
      this.refreshView();
      return;
    }
    if (this.blueprint.parts.length === 0) {
      if (this.currentChallengeId === "the-gap") { this.reject("Hãy lắp một phương tiện trước khi bắt đầu test."); return; }
      await this.loadSample();
    }
    this.state = "Compiling";
    this.feedback = { tone: "neutral", message: "Đang khởi động cỗ máy và nạp mô phỏng vật lý Rapier…" };
    this.refreshView();
    let orphanedWorld: { dispose(): void } | undefined;
    try {
      await this.pruneDisconnectedParts();
      const snapshot = await this.composition.building.acquireSimulationSnapshot("sandbox-machine");
      if (!snapshot.ok) throw new Error(snapshot.error.code);
      this.simulationLockHeld = true;
      const currentEnv = this.getCurrentChallenge().environment;
      const compiled = this.composition.simulationCompiler.compile(snapshot.value, currentEnv);
      if (!compiled.ok) {
        if (compiled.error.code === "simulation.compile.disconnected-machine") {
          throw new Error("Xe bị đứt đoạn! Các khối cần được gắn liền mạch với nhau.");
        }
        throw new Error(compiled.error.code);
      }
      orphanedWorld = compiled.value.world;
      this.renderer.resetCamera();
      this.session = this.composition.createSimulationSession(compiled.value.world, this.renderer);
      orphanedWorld = undefined;
      this.host.dataset.physicsSpecificationJson = serializePhysicsSpecification(compiled.value.specification);
      this.session.start();
      this.evaluator.reset();
      this.evaluator.start();
      if (this.currentChallengeId === "the-gap") {
        this.activeSupplyAttempt = {
          version: this.supplyMission.stage === "build-v2" ? 2 : 1,
          maxDistanceCm: 0,
          elapsedSeconds: 0,
          stable: true,
          touchedFlood: false,
        };
      }
      this.aiService.recordAttemptStart(this.currentChallengeId);
      this.lastRootPos = undefined;
      this.updatePhysicsDiagnostics();
      this.state = "Running";
      const hasDrive = compiled.value.specification.actuators.some((actuator) => actuator.action === "drive");
      const hasSteer = compiled.value.specification.actuators.some((actuator) => actuator.action === "steer");
      const driveActuators = compiled.value.specification.actuators.filter((actuator) => actuator.action === "drive").length;
      const steeringActuators = compiled.value.specification.actuators.filter((actuator) => actuator.action === "steer").length;
      const controlMessage = `${hasDrive ? "Tiến/Lùi bằng W/S hoặc phím Mũi Tên" : "Chưa có bánh dẫn động"} · ${hasSteer ? "Rẽ Trái/Phải bằng A/D" : "Chưa có khớp bẻ lái"}`;
      const missionGoal = this.currentChallengeId === "the-gap"
        ? "Đỡ chắc Supply Pod và đưa hộp vào Khu cứu hộ!"
        : "Hãy đưa xe về vạch đích vàng!";
      this.feedback = { tone: "good", message: `Đang lái! ${controlMessage}. ${missionGoal}` };
      this.composition.emit("simulation.started", { blueprintVersion: snapshot.value.version, bodies: compiled.value.specification.bodies.length, joints: compiled.value.specification.joints.length, actuators: compiled.value.specification.actuators.length, driveActuators, steeringActuators });
      this.refreshView();
    } catch (error) {
      try { orphanedWorld?.dispose(); } catch { /* Continue transaction rollback. */ }
      await this.failRuntime(error, "start");
    }
  }

  private updateSupplyAttempt(transform: TransformSnapshot, elapsedSeconds: number): void {
    const attempt = this.activeSupplyAttempt;
    const challenge = this.getCurrentChallenge();
    if (attempt === undefined || challenge.environment.payload === undefined) return;
    const startZ = challenge.environment.payload.position[2];
    const goalZ = challenge.environment.goalZone?.position[2] ?? startZ + 1;
    const progress = Math.max(0, Math.min(1, (transform.position[2] - startZ) / Math.max(0.001, goalZ - startZ)));
    attempt.maxDistanceCm = Math.max(attempt.maxDistanceCm, progress * 50);
    attempt.elapsedSeconds = elapsedSeconds;
    attempt.touchedFlood ||= transform.position[1] < 0;
    attempt.stable &&= Math.hypot(transform.rotation[0], transform.rotation[2]) < 0.38;
  }

  private finishSupplyAttempt(completed: boolean, elapsedSeconds: number): void {
    const active = this.activeSupplyAttempt;
    if (active === undefined) return;
    const result: SupplyAttempt = {
      version: active.version,
      completed,
      elapsedSeconds: Math.max(0.1, elapsedSeconds || active.elapsedSeconds),
      distanceCm: completed ? 50 : Math.round(active.maxDistanceCm),
      stable: active.stable,
      touchedFlood: active.touchedFlood,
      partCount: this.blueprint.parts.length,
    };
    this.supplyMission.attempts = [...this.supplyMission.attempts.filter((item) => item.version !== result.version), result].sort((a, b) => a.version - b.version);
    this.supplyMission.stage = result.version === 1 ? "review-v1" : "reflection";
    this.supplyMission.showModal = true;
    this.activeSupplyAttempt = undefined;
    if (result.version === 2 && result.completed) {
      this.challengeProgress["the-gap"] = { completed: true, stars: result.elapsedSeconds <= 60 ? 3 : 1, bestTimeSeconds: result.elapsedSeconds };
      this.saveProgress();
    }
    this.saveSupplyMission();
  }

  private async stopAndReset(): Promise<void> {
    try {
      if (this.state === "Running" && this.activeSupplyAttempt !== undefined) this.finishSupplyAttempt(false, this.activeSupplyAttempt.elapsedSeconds);
      await this.cleanupSimulation();
      this.renderer.setEnvironment(this.getCurrentChallenge().environment);
      await this.syncBlueprint();
      this.state = "Building";
      this.feedback = { tone: "good", message: "Đã đưa xe về xưởng chế tạo tại vạch xuất phát. Bạn có thể chỉnh sửa tiếp." };
      this.composition.emit("simulation.reset", { blueprintVersion: this.blueprint.version });
      this.refreshView();
    } catch (error) {
      await this.failRuntime(error, "reset");
    }
  }

  private async retry(): Promise<void> {
    this.victoryState = undefined;
    this.failState = undefined;
    await this.stopAndReset();
    if (this.state === "Building") await this.start();
  }

  private async cleanupSimulation(): Promise<void> {
    const errors: unknown[] = [];
    const session = this.session;
    this.session = undefined;
    soundEffects.stopMotor();
    if (session !== undefined) {
      try { session.stop(); } catch (error) { errors.push(error); }
      try { session.dispose({ disposeRenderer: false }); } catch (error) { errors.push(error); }
    }
    if (this.simulationLockHeld) {
      try {
        if (this.pendingReleaseFailures > 0) {
          this.pendingReleaseFailures -= 1;
          throw new Error("test.injected-release-failure");
        }
        await this.composition.building.releaseSimulation("sandbox-machine");
        this.simulationLockHeld = false;
      } catch (error) { errors.push(error); }
    }
    if (errors.length > 0) throw new AggregateError(errors, "simulation.cleanup-failed");
  }

  private async failRuntime(error: unknown, phase: string): Promise<void> {
    if (this.recovering || this.disposed) return;
    this.recovering = true;
    const reason = error instanceof Error ? error.message : String(error);
    try {
      try { await this.cleanupSimulation(); } catch (cleanupError) {
        this.composition.emit("simulation.cleanup.failed", { phase, reason: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) }, "error");
      }
      this.lastFrameTime = 0;
      this.state = "Failed";
      this.feedback = { tone: "bad", message: `Có sự cố vật lý (${phase}): ${reason}. Bấm Làm Lại để sửa xe.` };
      this.composition.emit("simulation.runtime.failed", { phase, reason }, "error");
      this.refreshView();
    } finally {
      this.recovering = false;
    }
  }

  private async loadSample(): Promise<void> {
    if (this.state === "Running") await this.stopAndReset();
    if (this.state !== "Building") return;
    try {
      const sample = createRuntimeSampleFixture(this.composition.catalog, this.selectedSampleId);
      const replaced = await this.composition.building.replace("sandbox-machine", sample);
      if (!replaced.ok) { this.reject(replaced.error.code); return; }
      await this.syncBlueprint();
      this.selectedPartId = "chassis";
      this.renderer.setSelection(this.selectedPartId);
      const sampleDefinition = RUNTIME_SAMPLES.find((c) => c.id === this.selectedSampleId);
      this.feedback = { tone: "good", message: `Đã nạp xe mẫu: ${sampleDefinition?.label ?? "Xe mẫu"} với ${String(this.blueprint.parts.length)} bộ phận. Bấm '🎮 Lái Thử' để trải nghiệm!` };
      this.refreshView();
    } catch (error) {
      this.reject(error instanceof Error ? error.message : String(error));
    }
  }

  private async pruneDisconnectedParts(): Promise<void> {
    await this.syncBlueprint();
    if (this.blueprint.parts.length <= 1) return;
    const root = this.blueprint.parts[0];
    if (root === undefined) return;
    const visited = new Set<string>([String(root.id)]);
    const queue = [String(root.id)];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      for (const c of this.blueprint.connections) {
        const next = String(c.a.partId) === current ? String(c.b.partId) : String(c.b.partId) === current ? String(c.a.partId) : undefined;
        if (next !== undefined && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    for (const part of this.blueprint.parts) {
      if (!visited.has(String(part.id))) {
        await this.composition.building.removePart("sandbox-machine", String(part.id));
      }
    }
    await this.syncBlueprint();
  }

  private async deleteSelected(): Promise<void> {
    if (this.state !== "Building" || this.selectedPartId === undefined) return;
    const toDelete = this.selectedPartId;
    this.selectedPartId = undefined;
    const result = await this.composition.building.removePart("sandbox-machine", toDelete);
    if (!result.ok) { this.reject(result.error.code); return; }
    await this.pruneDisconnectedParts();
    soundEffects.playSnap();
    this.feedback = { tone: "good", message: "Đã tháo module thành công khỏi xe." };
    this.refreshView();
  }

  private async rotateSelected(): Promise<void> {
    if (this.state !== "Building" || this.selectedPartId === undefined) return;
    if (this.blueprint.connections.some((c) => String(c.a.partId) === this.selectedPartId || String(c.b.partId) === this.selectedPartId)) { this.reject("Hãy tháo kết nối trước khi xoay khối."); return; }
    const result = await this.composition.building.rotatePart("sandbox-machine", this.selectedPartId, "y");
    if (!result.ok) { this.reject(result.error.code); return; }
    await this.syncBlueprint();
    this.feedback = { tone: "good", message: "Đã xoay khối 90°." };
    this.refreshView();
  }

  private async disconnect(connectionId: string | undefined): Promise<void> {
    if (this.state !== "Building" || connectionId === undefined) return;
    const result = await this.composition.building.disconnectParts("sandbox-machine", connectionId);
    if (!result.ok) { this.reject(result.error.code); return; }
    await this.pruneDisconnectedParts();
    soundEffects.playSnap();
    this.feedback = { tone: "good", message: "Đã tháo rời khớp nối và giải phóng module." };
    this.refreshView();
  }

  private exportEvents(): void {
    const blob = new Blob([this.composition.eventLog.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "stem-car-events.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private reject(message: string): void {
    const friendlyMessages: Record<string, string> = {
      "building.part.duplicate-id": "Trùng ID linh kiện trên xe. Vui lòng bấm gắn lại để tự động lấy ID mới!",
      "building.connection.occupied": "Khớp nối này đã có linh kiện khác gắn vào.",
      "building.connection.incompatible": "Khớp nối không tương thích.",
      "building.connection.invalid": "Khớp nối không hợp lệ.",
      "simulation.compile.disconnected-machine": "Xe bị đứt đoạn! Các khối cần được gắn liền mạch với nhau.",
    };
    const displayMsg = friendlyMessages[message] ?? `Lỗi: ${message}`;
    this.feedback = { tone: "bad", message: displayMsg };
    this.composition.emit("building.command.rejected.ui", { message }, "warn");
    this.refreshView();
  }

  private updatePhysicsDiagnostics(): void {
    if (this.session === undefined) return;
    const rootId = this.blueprint.parts[0]?.id;
    const transform = rootId === undefined ? undefined : this.renderer.getLastFrame()?.transforms[String(rootId)];
    if (transform === undefined) return;
    this.host.dataset.physicsRootPosition = JSON.stringify(transform.position);
    this.host.dataset.physicsRootRotation = JSON.stringify(transform.rotation);
    this.host.dataset.physicsControls = JSON.stringify(this.session.getLastControls());
    const transforms = this.renderer.getLastFrame()?.transforms;
    if (transforms !== undefined) this.host.dataset.physicsTransforms = JSON.stringify(transforms);
  }

  private refreshView(): void {
    if (this.disposed) return;
    const events = this.composition.memoryLog.snapshot();
    const currentCandidate = this.placement?.candidates[this.placement.candidateIndex];
    const validation = this.placement && currentCandidate
      ? validatePlacementCandidate(this.blueprint, this.placement.definitionId, currentCandidate, this.composition.catalog, this.placement.rotationSteps)
      : undefined;
    this.view.render({
      state: this.state,
      rendererReady: this.rendererReady,
      blueprint: this.blueprint,
      ...(this.selectedPartId === undefined ? {} : { selectedPartId: this.selectedPartId }),
      ...(this.feedback === undefined ? {} : { feedback: this.feedback }),
      ...(this.placement === undefined ? {} : {
        placement: {
          definitionId: this.placement.definitionId,
          candidateIndex: this.placement.candidateIndex,
          candidateCount: this.placement.candidates.length,
          valid: validation?.valid ?? true,
          reason: validation?.reason,
        },
      }),
      ...(currentCandidate === undefined ? {} : { placementTarget: { targetPartId: currentCandidate.targetPartId, targetSocketId: currentCandidate.targetSocketId, sourceSocketId: currentCandidate.sourceSocketId } }),
      assemblyGuide: this.getAssemblyGuide(),
      samples: RUNTIME_SAMPLES,
      selectedSampleId: this.selectedSampleId,
      visualVariants: this.variants,
      events,
      eventFilter: this.eventFilter,
      challenges: this.challenges,
      currentChallengeId: this.currentChallengeId,
      challengeProgress: this.challengeProgress,
      gameMode: this.gameMode,
      victoryState: this.victoryState,
      failState: this.failState,
      soundMuted: soundEffects.isMuted(),
      showWelcomeModal: this.showWelcomeModal,
      showChallengeModal: this.showChallengeModal,
      showAdvancedPanel: this.showAdvancedPanel,
      ...(this.currentChallengeId === "the-gap" ? {} : { challengeBriefing: { challenge: this.getCurrentChallenge(), showModal: this.showChallengeBriefingModal } }),
      ...(this.currentChallengeId === "the-gap" ? { supplyMission: { ...this.supplyMission, highestHintTier: this.aiService.getState().highestTierUnlocked } } : {}),
    });
    this.host.dataset.blueprintJson = JSON.stringify(this.blueprint);
    this.host.dataset.activeRafOwners = this.rafId === undefined ? "0" : "1";
    this.host.dataset.activePhysicsWorlds = String(RapierPhysicsWorld.getActiveWorldCount());
    this.host.dataset.activeInputListeners = String(KeyboardInputSource.getActiveListenerCount());
    this.host.dataset.activeRenderers = String(ThreeSimulationRenderer.getActiveRendererCount());
    const resources = this.renderer.getResourceStats();
    this.host.dataset.rendererGeometries = String(resources.geometries);
    this.host.dataset.rendererTextures = String(resources.textures);
  }

  private getAssemblyGuide(): readonly string[] {
    if (this.currentChallengeId === "the-gap") {
      return [
        "Tạo một hệ thống có thể đỡ Supply Pod khi hộp rơi xuống.",
        "Tự chọn cách lắp; xưởng sẽ không đưa mô hình mẫu.",
        "Khi sẵn sàng, đặt xe dưới hộp và bấm Chơi.",
      ];
    }
    const hinges = this.blueprint.parts.filter((part) => part.definitionId === "core.steering-hinge").length;
    const wheels = this.blueprint.parts.filter((part) => part.definitionId === "core.powered-wheel" || part.definitionId === "core.crawler-track" || part.definitionId === "core.drive-gear").length;
    const current = this.placement?.candidates[this.placement.candidateIndex];
    if (current !== undefined) {
      return [
        `Đang lắp: ${this.placement?.definitionId ?? ""}`,
        `Điểm kết nối: Gắn vào ${current.targetPartId}:${current.targetSocketId}`,
        "Bấm 'Xác nhận gắn' màu xanh hoặc nhấn phím R để xoay.",
      ];
    }
    if (this.blueprint.parts.length === 0) {
      return [
        "Bước 1: Chọn Khung Cơ Bản hoặc Dầm Khung Dài đặt xuống sàn làm bệ đỡ.",
        "Bước 2: Gắn Khớp Bẻ Lái hoặc Bánh Xe / Băng Xích vào các khớp nối.",
        "Bước 3: Nhấn nút Lái Thử để điều khiển xe vượt qua thử thách!",
      ];
    }
    if (hinges === 0 && wheels < 2) {
      return [
        "Mẹo: Bạn có thể gắn Khớp Bẻ Lái ở phía trước để xe có thể rẽ trái/phải.",
        "Sau đó gắn Bánh Động Cơ hoặc Băng Xích vào trục khớp bẻ lái.",
        "Hoặc gắn trực tiếp bánh xe vào khung để làm xe chạy thẳng!",
      ];
    }
    if (wheels < 4) {
      return [
        `Xe hiện có ${String(wheels)} bánh. Hãy gắn thêm bánh hoặc xích cho đủ các góc xe.`,
        "Dùng nút 'Đổi điểm gắn →' nếu muốn thử các vị trí lắp khác nhau.",
        "Sau khi xe cân đối, bấm '🎮 Lái Thử' để đua nào!",
      ];
    }
    return [
      "Chiếc xe đã có đầy đủ hệ thống dẫn động và bẻ lái!",
      "Nhấn '🎮 Lái Thử', dùng phím Mũi Tên (hoặc phím W/A/S/D) để lái.",
      "Bạn cũng có thể click vào các nút mũi tên ảo trên màn hình để lái xe!",
    ];
  }
}
