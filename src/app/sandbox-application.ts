import type { MachineBlueprint } from "../building/domain/contracts";
import { createPlacementPreview, findPlacementCandidates, rotatePlacementCandidate, rootTransform, type AssemblyPlacementCandidate } from "../building";
import { createRuntimeFourWheelFixture, defaultSimulationEnvironment, serializePhysicsSpecification, type SimulationSession } from "../simulation";
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
  private feedback: AppViewModel["feedback"] = { tone: "neutral", message: "Loading authoritative part manifests…" };
  private readonly variants: Record<string, string> = { "core.structural-block": "A", "core.powered-wheel": "A", "core.steering-hinge": "A" };
  private eventFilter = "";
  private session: SimulationSession | undefined;
  private lastFrameTime = 0;
  private rafId: number | undefined;
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
    const delta = this.lastFrameTime === 0 ? 0 : Math.min(0.1, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    if (this.session !== undefined) this.session.advance(delta);
    this.updatePhysicsDiagnostics();
    this.rafId = requestAnimationFrame(this.onFrame);
  };

  public constructor(private readonly host: HTMLElement, private readonly composition: ApplicationComposition) {
    this.view = new AppView(host);
    this.renderer = new ThreeSimulationRenderer({ onPick: this.onPick });
    this.renderer.mount(this.view.getElement("viewport"));
    this.renderer.setEnvironment(defaultSimulationEnvironment());
    this.host.addEventListener("click", this.onClick);
    this.host.addEventListener("change", this.onChange);
    this.host.addEventListener("input", this.onInput);
    window.addEventListener("keydown", this.onKeyDown);
    this.unsubscribeLog = this.composition.memoryLog.subscribe(() => { this.refreshView(); });
    this.rafId = requestAnimationFrame(this.onFrame);
  }

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
    window.removeEventListener("keydown", this.onKeyDown);
    this.host.removeEventListener("click", this.onClick);
    this.host.removeEventListener("change", this.onChange);
    this.host.removeEventListener("input", this.onInput);
    this.unsubscribeLog();
    if (this.session !== undefined) {
      this.session.dispose();
      this.session = undefined;
      await this.composition.building.releaseSimulation("sandbox-machine");
    }
    this.renderer.dispose();
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
    this.refreshView();
  }

  private async beginPlacement(definitionId: string | undefined): Promise<void> {
    if (this.state !== "Building" || definitionId === undefined) return;
    if (this.blueprint.parts.length === 0) {
      if (definitionId !== "core.structural-block") {
        this.feedback = { tone: "bad", message: "A root structural block must be placed first." };
        this.refreshView();
        return;
      }
      const added = await this.composition.building.addPart("sandbox-machine", { id: "block-1", definitionId, transform: rootTransform() });
      if (!added.ok) { this.reject(added.error.code); return; }
      await this.syncBlueprint();
      this.feedback = { tone: "good", message: "Root block placed. Add another block, hinge or wheel from the palette." };
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
    this.feedback = { tone: "neutral", message: "Ghost placement is ready. Cycle sockets, rotate 90°, then confirm or cancel." };
    this.refreshView();
  }

  private paintPlacement(): void {
    if (this.placement === undefined) { this.renderer.setGhost(undefined); return; }
    const current = this.placement.candidates[this.placement.candidateIndex];
    if (current === undefined) return;
    const rotated = rotatePlacementCandidate(this.blueprint, this.placement.definitionId, current, this.composition.catalog, this.placement.rotationSteps);
    this.renderer.setGhost({ partId: this.placement.partId, definitionId: this.placement.definitionId, transform: rotated.transform, valid: true });
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
    this.feedback = { tone: "good", message: `${preview.placement.part.id} connected atomically. Continue building.` };
    this.refreshView();
  }

  private async start(): Promise<void> {
    if (this.state !== "Building") return;
    this.state = "Compiling";
    this.feedback = { tone: "neutral", message: "Locking blueprint and compiling Rapier bodies, joints and actuators…" };
    this.refreshView();
    const snapshot = await this.composition.building.acquireSimulationSnapshot("sandbox-machine");
    if (!snapshot.ok) { this.reject(snapshot.error.code); this.state = "Building"; this.refreshView(); return; }
    const compiled = this.composition.simulationCompiler.compile(snapshot.value, defaultSimulationEnvironment());
    if (!compiled.ok) {
      await this.composition.building.releaseSimulation("sandbox-machine");
      this.composition.emit("simulation.compile.failed", { code: compiled.error.code, ...(compiled.error.details === undefined ? {} : { details: compiled.error.details }) }, "error");
      this.state = "Building";
      this.feedback = { tone: "bad", message: `Compile rejected: ${compiled.error.code}. Edit the machine and try again.` };
      this.refreshView();
      return;
    }
    this.session = this.composition.createSimulationSession(compiled.value.world, this.renderer);
    this.host.dataset.physicsSpecificationJson = serializePhysicsSpecification(compiled.value.specification);
    this.session.start();
    this.updatePhysicsDiagnostics();
    this.state = "Running";
    this.feedback = { tone: "good", message: "Running. W/S or ↑/↓ drive · A/D or ←/→ steer · Stop returns to build pose." };
    this.composition.emit("simulation.started", { blueprintVersion: snapshot.value.version, bodies: compiled.value.specification.bodies.length, joints: compiled.value.specification.joints.length });
    this.refreshView();
  }

  private async stopAndReset(): Promise<void> {
    if (this.session === undefined) {
      this.state = "Building";
      this.refreshView();
      return;
    }
    this.session.stop();
    this.session.dispose({ disposeRenderer: false });
    this.session = undefined;
    await this.composition.building.releaseSimulation("sandbox-machine");
    await this.syncBlueprint();
    this.state = "Building";
    this.feedback = { tone: "good", message: "Reset to the immutable build blueprint. You can edit again." };
    this.composition.emit("simulation.reset", { blueprintVersion: this.blueprint.version });
    this.refreshView();
  }

  private async loadSample(): Promise<void> {
    if (this.state === "Running") await this.stopAndReset();
    if (this.state !== "Building") return;
    try {
      const sample = createRuntimeFourWheelFixture(this.composition.catalog);
      const replaced = await this.composition.building.replace("sandbox-machine", sample);
      if (!replaced.ok) { this.reject(replaced.error.code); return; }
      await this.syncBlueprint();
      this.selectedPartId = "chassis";
      this.renderer.setSelection(this.selectedPartId);
      this.feedback = { tone: "good", message: "Runtime sample loaded through the same authoritative socket solver. Palette assembly remains available." };
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
  }

  private refreshView(): void {
    if (this.disposed) return;
    const events = this.composition.memoryLog.snapshot();
    this.view.render({ state: this.state, blueprint: this.blueprint, ...(this.selectedPartId === undefined ? {} : { selectedPartId: this.selectedPartId }), ...(this.feedback === undefined ? {} : { feedback: this.feedback }), ...(this.placement === undefined ? {} : { placement: { definitionId: this.placement.definitionId, candidateIndex: this.placement.candidateIndex, candidateCount: this.placement.candidates.length, valid: true } }), visualVariants: this.variants, events, eventFilter: this.eventFilter });
    this.host.dataset.blueprintJson = JSON.stringify(this.blueprint);
    this.host.dataset.activeRafOwners = "1";
    this.host.dataset.activePhysicsWorlds = String(RapierPhysicsWorld.getActiveWorldCount());
    this.host.dataset.activeInputListeners = String(KeyboardInputSource.getActiveListenerCount());
    this.host.dataset.activeRenderers = String(ThreeSimulationRenderer.getActiveRendererCount());
    const resources = this.renderer.getResourceStats();
    this.host.dataset.rendererGeometries = String(resources.geometries);
    this.host.dataset.rendererTextures = String(resources.textures);
  }
}
