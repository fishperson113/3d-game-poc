import type { MachineBlueprint } from "../building/domain/contracts";
import { createPlacementPreview, findPlacementCandidates, rotatePlacementCandidate, rootTransform, type AssemblyPlacementCandidate } from "../building";
import { createRuntimeSampleFixture, defaultSimulationEnvironment, RUNTIME_SAMPLES, serializePhysicsSpecification, type RuntimeSampleId, type SimulationSession } from "../simulation";
import { ThreeSimulationRenderer } from "../adapters/three/three-simulation-renderer";
import { KeyboardInputSource, RapierPhysicsWorld } from "../adapters";
import { AppView, type AppViewModel } from "./ui/app-view";
import type { ApplicationComposition } from "./composition-root";
import type { RuntimeState } from "../kernel/runtime-contract";

interface PlacementState {
  readonly definitionId: string;
  readonly partId: string;
  readonly candidates: readonly AssemblyPlacementCandidate[];
  readonly candidateIndex: number;
  readonly rotationSteps: number;
}

export class SandboxApplication {
  private readonly view: AppView;
  private readonly renderer: ThreeSimulationRenderer;
  private blueprint: MachineBlueprint = { schemaVersion: 1, id: "sandbox-machine" as MachineBlueprint["id"], version: 0, parts: [], connections: [], controlBindings: [] };
  private state: RuntimeState = "LoadingChallenge";
  private selectedPartId: string | undefined;
  private placement: PlacementState | undefined;
  private selectedSampleId: RuntimeSampleId = "four-wheel-scout";
  private feedback: AppViewModel["feedback"] = { tone: "neutral", message: "Loading authoritative part manifests…" };
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
  private readonly onTestFault = (event: Event): void => {
    const detail = (event as CustomEvent<{ phase?: string }>).detail;
    if (detail.phase === "frame") this.pendingFrameFault = new Error("test.injected-frame-failure");
    if (detail.phase === "release") this.pendingReleaseFailures += 1;
  };
  private disposed = false;
  private readonly unsubscribeLog: () => void;

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const actionElement = target?.closest<HTMLElement>("[data-action]");
    if (actionElement === null || actionElement === undefined) return;
    const action = actionElement.dataset.action;
    if (action === undefined) return;
    if (action === "palette") void this.beginPlacement(actionElement.dataset.partId).catch((error: unknown) => { this.reject(error instanceof Error ? error.message : String(error)); });
    else if (action === "start") void this.start();
    else if (action === "retry") void this.retry();
    else if (action === "stop" || action === "reset") void this.stopAndReset();
    else if (action === "sample") void this.loadSample();
    else if (action === "confirm-placement") void this.confirmPlacement();
    else if (action === "cancel-placement") this.cancelPlacement();
    else if (action === "next-socket") this.changeCandidate(1);
    else if (action === "previous-socket") this.changeCandidate(-1);
    else if (action === "rotate-placement") this.rotatePlacement();
    else if (action === "rotate-selected") void this.rotateSelected();
    else if (action === "delete-selected") void this.deleteSelected();
    else if (action === "disconnect") void this.disconnect(actionElement.dataset.connectionId);
    else if (action === "export") this.exportEvents();
  };

  private readonly onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (target?.dataset.action === "sample-select") {
      const selected = RUNTIME_SAMPLES.find((sample) => sample.id === target.value);
      if (selected === undefined) return;
      this.selectedSampleId = selected.id;
      this.feedback = { tone: "neutral", message: `${selected.label} selected. Click Load selected to put it into Build mode.` };
      this.refreshView();
      return;
    }
    if (target?.dataset.action !== "variant" || target.dataset.partId === undefined) return;
    this.variants[target.dataset.partId] = target.value;
    this.renderer.setBlueprint(this.blueprint, this.composition.catalog, this.variants);
    this.renderer.setSelection(this.selectedPartId);
    this.feedback = { tone: "good", message: `Visual ${target.value} selected for QA. Blueprint and physics metadata are unchanged.` };
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
      if (this.session !== undefined) this.session.advance(delta);
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

  public constructor(private readonly host: HTMLElement, private readonly composition: ApplicationComposition) {
    this.view = new AppView(host);
    this.renderer = new ThreeSimulationRenderer({
      onPick: this.onPick,
      onContextLost: (error) => { this.rendererReady = false; void this.failRuntime(error, "webgl-context-lost"); },
      onContextRestored: () => {
        this.rendererReady = true;
        this.composition.emit("renderer.webgl.context-restored", {}, "info");
        if (this.state === "Failed") {
          this.feedback = { tone: "neutral", message: "WebGL context restored. Use Retry to rebuild the simulation, or Reset to edit." };
          this.refreshView();
        }
      },
    });
    this.renderer.mount(this.view.getElement("viewport"));
    this.renderer.setEnvironment(defaultSimulationEnvironment());
    this.host.addEventListener("click", this.onClick);
    this.host.addEventListener("change", this.onChange);
    this.host.addEventListener("input", this.onInput);
    this.host.addEventListener("sandbox:test-fault", this.onTestFault);
    window.addEventListener("keydown", this.onKeyDown);
    this.unsubscribeLog = this.composition.memoryLog.subscribe(() => { this.logDirty = true; });
    this.rafId = requestAnimationFrame(this.onFrame);
  }

  private logDirty = false;
  private lastLogRefresh = 0;

  public async initialize(): Promise<void> {
    try {
      const created = await this.composition.building.create("sandbox-machine");
      if (!created.ok) throw new Error(created.error.code);
      await this.syncBlueprint();
      this.state = "Building";
      this.feedback = { tone: "good", message: "Build mode ready. Place a structural block to begin." };
      this.refreshView();
    } catch (error) {
      this.feedback = { tone: "bad", message: `Sandbox boot failed: ${error instanceof Error ? error.message : String(error)}` };
      this.refreshView();
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    window.removeEventListener("keydown", this.onKeyDown);
    this.host.removeEventListener("click", this.onClick);
    this.host.removeEventListener("change", this.onChange);
    this.host.removeEventListener("input", this.onInput);
    this.host.removeEventListener("sandbox:test-fault", this.onTestFault);
    this.unsubscribeLog();
    try { await this.cleanupSimulation(); } catch { /* Best-effort shutdown. */ }
    try { this.renderer.dispose(); } catch { /* Best-effort shutdown. */ }
  }

  public getBlueprint(): MachineBlueprint { return this.blueprint; }

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

  private async beginPlacement(definitionId: string | undefined): Promise<void> {
    if (this.state !== "Building" || definitionId === undefined) return;
    if (this.blueprint.parts.length === 0) {
      const prefix = definitionId === "core.structural-block" ? "block" : definitionId === "core.powered-wheel" ? "wheel" : "hinge";
      const partId = `${prefix}-1`;
      const added = await this.composition.building.addPart("sandbox-machine", { id: partId, definitionId, transform: rootTransform() });
      if (!added.ok) { this.reject(added.error.code); return; }
      this.selectedPartId = partId;
      await this.syncBlueprint();
      this.renderer.setSelection(this.selectedPartId);
      this.feedback = { tone: "good", message: `${partId} placed as the root. Start now to test it, or add any compatible part from the palette.` };
      this.refreshView();
      return;
    }
    const candidates = findPlacementCandidates(this.blueprint, definitionId, this.composition.catalog);
    if (candidates.length === 0) {
      this.feedback = { tone: "bad", message: "No free compatible socket is available for that part." };
      this.refreshView();
      return;
    }
    const prefix = definitionId === "core.structural-block" ? "block" : definitionId === "core.powered-wheel" ? "wheel" : "hinge";
    const partId = `${prefix}-${String(this.blueprint.parts.filter((part) => String(part.id).startsWith(prefix)).length + 1)}`;
    this.placement = { definitionId, partId, candidates, candidateIndex: 0, rotationSteps: 0 };
    this.paintPlacement();
    const role = definitionId === "core.steering-hinge" ? "hinge.mount → chassis front mount" : definitionId === "core.powered-wheel" ? "wheel.axle → highlighted hinge axle or chassis mount" : "frame socket → highlighted compatible mount";
    this.feedback = { tone: "neutral", message: `Ghost ready: ${role}. Confirm connection when the target socket is highlighted.` };
    this.refreshView();
  }

  private paintPlacement(): void {
    if (this.placement === undefined) { this.renderer.setGhost(undefined); this.renderer.setSocketHighlights([]); return; }
    const current = this.placement.candidates[this.placement.candidateIndex];
    if (current === undefined) return;
    const rotated = rotatePlacementCandidate(this.blueprint, this.placement.definitionId, current, this.composition.catalog, this.placement.rotationSteps);
    this.renderer.setGhost({ partId: this.placement.partId, definitionId: this.placement.definitionId, transform: rotated.transform, valid: true });
    this.renderer.setSocketHighlights([`${current.targetPartId}::${current.targetSocketId}`]);
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
    this.feedback = { tone: "neutral", message: "Placement cancelled; blueprint is unchanged." };
    this.refreshView();
  }

  private async confirmPlacement(): Promise<void> {
    if (this.placement === undefined || this.state !== "Building") return;
    const candidate = this.placement.candidates[this.placement.candidateIndex];
    if (candidate === undefined) return;
    const rotated = rotatePlacementCandidate(this.blueprint, this.placement.definitionId, candidate, this.composition.catalog, this.placement.rotationSteps);
    const preview = createPlacementPreview(this.blueprint, this.placement.definitionId, this.placement.partId, rotated, this.composition.catalog);
    const placed = await this.composition.building.placeAndConnect("sandbox-machine", preview.placement);
    if (!placed.ok) { this.reject(placed.error.code); return; }
    this.placement = undefined;
    this.renderer.setGhost(undefined);
    await this.syncBlueprint();
    this.selectedPartId = preview.placement.part.id;
    this.renderer.setSelection(this.selectedPartId);
    const nextMessage = this.placementDescription(preview.placement.part.definitionId, true);
    this.feedback = { tone: "good", message: `${preview.placement.part.id} connected atomically. ${nextMessage}` };
    this.refreshView();
  }

  private async start(): Promise<void> {
    if (this.state !== "Building") return;
    if (!this.rendererReady) { this.reject("renderer.webgl-context-unavailable"); return; }
    this.state = "Compiling";
    this.feedback = { tone: "neutral", message: "Locking blueprint and compiling Rapier bodies, joints and actuators…" };
    this.refreshView();
    let orphanedWorld: { dispose(): void } | undefined;
    try {
      const snapshot = await this.composition.building.acquireSimulationSnapshot("sandbox-machine");
      if (!snapshot.ok) throw new Error(snapshot.error.code);
      this.simulationLockHeld = true;
      const compiled = this.composition.simulationCompiler.compile(snapshot.value, defaultSimulationEnvironment());
      if (!compiled.ok) throw new Error(compiled.error.code);
      orphanedWorld = compiled.value.world;
      this.session = this.composition.createSimulationSession(compiled.value.world, this.renderer);
      orphanedWorld = undefined;
      this.host.dataset.physicsSpecificationJson = serializePhysicsSpecification(compiled.value.specification);
      this.session.start();
      this.updatePhysicsDiagnostics();
      this.state = "Running";
      const hasDrive = compiled.value.specification.actuators.some((actuator) => actuator.action === "drive");
      const hasSteer = compiled.value.specification.actuators.some((actuator) => actuator.action === "steer");
      const driveActuators = compiled.value.specification.actuators.filter((actuator) => actuator.action === "drive").length;
      const steeringActuators = compiled.value.specification.actuators.filter((actuator) => actuator.action === "steer").length;
      const controlMessage = `${hasDrive ? "W/S or ↑/↓ drive" : "No drive actuator yet"} · ${hasSteer ? "A/D or ←/→ steer" : "No steering actuator yet"}`;
      this.feedback = { tone: "good", message: `Running. ${controlMessage}. Add parts after Reset; this machine is allowed to be incomplete.` };
      this.composition.emit("simulation.started", { blueprintVersion: snapshot.value.version, bodies: compiled.value.specification.bodies.length, joints: compiled.value.specification.joints.length, actuators: compiled.value.specification.actuators.length, driveActuators, steeringActuators });
      this.refreshView();
    } catch (error) {
      try { orphanedWorld?.dispose(); } catch { /* Continue transaction rollback. */ }
      await this.failRuntime(error, "start");
    }
  }

  private async stopAndReset(): Promise<void> {
    try {
      await this.cleanupSimulation();
      await this.syncBlueprint();
      this.state = "Building";
      this.feedback = { tone: "good", message: "Reset to the immutable build blueprint. You can edit again." };
      this.composition.emit("simulation.reset", { blueprintVersion: this.blueprint.version });
      this.refreshView();
    } catch (error) {
      await this.failRuntime(error, "reset");
    }
  }

  private async retry(): Promise<void> {
    if (this.state !== "Failed") return;
    if (!this.rendererReady) {
      this.feedback = { tone: "bad", message: "WebGL context is still unavailable. Retry becomes available after the browser restores it." };
      this.refreshView();
      return;
    }
    await this.stopAndReset();
    if ((this.state as RuntimeState) === "Building") await this.start();
  }

  private async cleanupSimulation(): Promise<void> {
    const errors: unknown[] = [];
    const session = this.session;
    this.session = undefined;
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
      this.feedback = { tone: "bad", message: `Runtime failed during ${phase}: ${reason}. Retry rebuilds from the saved blueprint; Reset returns to Build mode.` };
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
    const sampleDefinition = RUNTIME_SAMPLES.find((candidate) => candidate.id === this.selectedSampleId);
    const wheelCount = this.blueprint.parts.filter((part) => part.definitionId === "core.powered-wheel").length;
    const hingeCount = this.blueprint.parts.filter((part) => part.definitionId === "core.steering-hinge").length;
    this.feedback = { tone: "good", message: `${sampleDefinition?.label ?? "Runtime sample"} loaded: ${String(this.blueprint.parts.length)} parts · ${String(wheelCount)} wheels · ${String(hingeCount)} steering hinges · ${String(this.blueprint.connections.length)} joints. Palette assembly remains available.` };
      this.refreshView();
    } catch (error) {
      this.reject(error instanceof Error ? error.message : String(error));
    }
  }

  private async deleteSelected(): Promise<void> {
    if (this.state !== "Building" || this.selectedPartId === undefined) return;
    if (this.selectedPartId === "chassis" && this.blueprint.parts.length > 1) { this.reject("Cannot delete the root while other parts are attached."); return; }
    const result = await this.composition.building.removePart("sandbox-machine", this.selectedPartId);
    if (!result.ok) { this.reject(result.error.code); return; }
    this.selectedPartId = undefined;
    await this.syncBlueprint();
    this.feedback = { tone: "good", message: "Part removed with its connections and bindings." };
    this.refreshView();
  }

  private async rotateSelected(): Promise<void> {
    if (this.state !== "Building" || this.selectedPartId === undefined) return;
    if (this.blueprint.connections.some((connection) => String(connection.a.partId) === this.selectedPartId || String(connection.b.partId) === this.selectedPartId)) { this.reject("Disconnect the part before rotating it so joint anchors stay exact."); return; }
    const result = await this.composition.building.rotatePart("sandbox-machine", this.selectedPartId, "y");
    if (!result.ok) { this.reject(result.error.code); return; }
    await this.syncBlueprint();
    this.feedback = { tone: "good", message: "Part rotated 90°." };
    this.refreshView();
  }

  private async disconnect(connectionId: string | undefined): Promise<void> {
    if (this.state !== "Building" || connectionId === undefined) return;
    const result = await this.composition.building.disconnectParts("sandbox-machine", connectionId);
    if (!result.ok) { this.reject(result.error.code); return; }
    await this.syncBlueprint();
    this.feedback = { tone: "good", message: `Disconnected ${connectionId}.` };
    this.refreshView();
  }

  private exportEvents(): void {
    const blob = new Blob([this.composition.eventLog.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sandbox-events.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private reject(message: string): void {
    this.feedback = { tone: "bad", message: `Rejected: ${message}` };
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
    this.view.render({ state: this.state, rendererReady: this.rendererReady, blueprint: this.blueprint, ...(this.selectedPartId === undefined ? {} : { selectedPartId: this.selectedPartId }), ...(this.feedback === undefined ? {} : { feedback: this.feedback }), ...(this.placement === undefined ? {} : { placement: { definitionId: this.placement.definitionId, candidateIndex: this.placement.candidateIndex, candidateCount: this.placement.candidates.length, valid: true } }), ...(currentCandidate === undefined ? {} : { placementTarget: { targetPartId: currentCandidate.targetPartId, targetSocketId: currentCandidate.targetSocketId, sourceSocketId: currentCandidate.sourceSocketId } }), assemblyGuide: this.getAssemblyGuide(), samples: RUNTIME_SAMPLES, selectedSampleId: this.selectedSampleId, visualVariants: this.variants, events, eventFilter: this.eventFilter });
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
    const hinges = this.blueprint.parts.filter((part) => part.definitionId === "core.steering-hinge").length;
    const wheels = this.blueprint.parts.filter((part) => part.definitionId === "core.powered-wheel").length;
    const current = this.placement?.candidates[this.placement.candidateIndex];
    const rootId = String(this.blueprint.parts[0]?.id ?? "block-1");
    const rootDefinitionId = this.blueprint.parts[0]?.definitionId;
    if (current !== undefined) {
      const source = current.sourceSocketId;
      const target = `${current.targetPartId}:${current.targetSocketId}`;
      return this.placement?.definitionId === "core.steering-hinge"
        ? [`Confirm hinge.${source} → ${target}. This creates the steering joint.`, "Repeat for the other front mount; use socket → if you want the next candidate.", "Then add a Powered wheel and confirm wheel.axle → hinge.axle."]
        : this.placement?.definitionId === "core.powered-wheel"
          ? [`Confirm wheel.${source} → ${target}. For steering, target must end in :axle on a hinge.`, "The highlighted socket is the exact physics joint anchor; no free-floating part is created.", "Use W/S to drive after four wheels and two hinges are connected."]
          : [`Confirm ${source} → ${target} to extend the chassis.`, "Green ghost means the socket pair is compatible.", "Use the same palette flow to add wheels to the new frame block."];
    }
    if (this.blueprint.parts.length === 0) return ["Place any palette part to begin; a Structural block is the usual chassis root.", "You can press Start with only that part to test an incomplete machine.", "Add compatible parts whenever you want; the target socket will be highlighted."];
    if (rootDefinitionId !== "core.structural-block") return [`${rootId} is the root experiment; there is no required chassis shape.`, "Choose any compatible part and confirm the highlighted socket.", "Start is allowed now; add or remove parts after Reset to explore the result."];
    if (hinges === 0) return ["Click Steering hinge in the palette.", `Confirm hinge.mount → ${rootId}:mount-front-left; the target socket will glow.`, "Start is allowed at any stage; add a second hinge and wheels whenever you want."];
    if (hinges === 1) return ["Click Steering hinge again.", `The next candidate is ${rootId}:mount-front-right; confirm the highlighted target.`, "The hinge's axle is where its Powered wheel must attach."];
    if (wheels < 2) return ["Click Powered wheel in the palette.", "Confirm wheel.axle → hinge-1:axle or hinge-2:axle.", "The wheel must attach to the hinge axle to steer with it."];
    if (wheels < 4) return ["Add Powered wheels to the two free rear chassis mounts.", "Use socket → to cycle candidates; the label tells you the exact target.", "When the chassis has four wheels, click Start and drive with W/S + A/D."];
    return ["The machine has steering hinges and four or more powered wheels.", "Click Start, then use W/S or ↑/↓ to drive and A/D or ←/→ to steer.", "Use Stop/Reset to return to this blueprint and continue editing."];
  }

  private placementDescription(definitionId: string, connected: boolean): string {
    if (definitionId === "core.steering-hinge") return connected ? "Next: add the second hinge, then attach wheels to both hinge.axle sockets." : "";
    if (definitionId === "core.powered-wheel") return connected ? "Keep adding wheels; a steering wheel must be on a hinge axle." : "";
    return connected ? "Continue adding parts from the palette." : "";
  }
}
