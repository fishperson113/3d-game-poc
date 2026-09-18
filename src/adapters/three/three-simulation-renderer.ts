import * as THREE from "three";
import type { MachineBlueprint } from "../../building/domain/contracts";
import { worldSocketFrame, quaternionFromEuler, type Vector3Tuple } from "../../kernel/math";
import { PartVisualRegistry } from "../../parts/visual-registry";
import type { RuntimePartCatalog } from "../../parts/catalog";
import type { PartVisualInstance } from "./part-visual";
import type { SimulationFrame, SimulationRenderer } from "../../simulation/ports/simulation-renderer";
import type { SimulationEnvironment } from "../../simulation/ports/physics-world";

export interface GhostPlacement {
  readonly partId: string;
  readonly definitionId: string;
  readonly transform: { readonly position: readonly [number, number, number]; readonly rotation: readonly [number, number, number] };
  readonly valid: boolean;
}

export interface ThreeRendererOptions {
  readonly onPick?: (partId: string) => void;
  readonly onContextLost?: (error: Error) => void;
  readonly onContextRestored?: () => void;
}

let activeRendererCount = 0;

function configureGhost(root: THREE.Group, valid: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const renderable = object as THREE.Mesh;
    const material = renderable.material;
    for (const item of Array.isArray(material) ? material : [material]) {
      item.transparent = true;
      item.opacity = 0.42;
      if (item instanceof THREE.MeshStandardMaterial || item instanceof THREE.MeshBasicMaterial) item.color.set(valid ? 0x83d68c : 0xe76f67);
    }
  });
}

export class ThreeSimulationRenderer implements SimulationRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  private readonly buildRoot = new THREE.Group();
  private readonly environmentRoot = new THREE.Group();
  private readonly socketRoot = new THREE.Group();
  private readonly socketMarkers = new Map<string, THREE.Mesh>();
  private readonly visualRegistry = new PartVisualRegistry();
  private readonly visuals = new Map<string, PartVisualInstance>();
  private readonly partRoots = new Map<string, THREE.Group>();
  private readonly variants = new Map<string, string>();
  private canvas: HTMLCanvasElement | undefined;
  private renderer: THREE.WebGLRenderer | undefined;
  private ghost: PartVisualInstance | undefined;
  private ghostRoot: THREE.Group | undefined;
  private payloadVisual: PartVisualInstance | undefined;
  private payloadId: string | undefined;
  private selectionHighlight: THREE.BoxHelper | undefined;
  private disposed = false;
  private theta = 2.79;
  private phi = 0.52;
  private radius = 10;
  private readonly cameraTarget = new THREE.Vector3(0, 1, 0);
  private currentSpawn: Vector3Tuple = [0, 0.75, 0];
  private lastFrame: SimulationFrame | undefined;
  private followedPartId: string | undefined;
  private readonly followedPosition = new THREE.Vector3();
  private readonly onPick: ((partId: string) => void) | undefined;
  private readonly onContextLost: ((error: Error) => void) | undefined;
  private readonly onContextRestored: (() => void) | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private dragDistance = 0;
  private suppressNextClick = false;

  private readonly onCanvasClick = (event: MouseEvent): void => {
    if (this.suppressNextClick) { this.suppressNextClick = false; return; }
    if (this.canvas === undefined || this.onPick === undefined) return;
    const bounds = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hits = raycaster.intersectObjects([...this.partRoots.values()], true);
    const partId = hits.find((hit) => typeof hit.object.userData.partId === "string")?.object.userData.partId as string | undefined;
    if (partId !== undefined) this.onPick(partId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.canvas === undefined || !this.dragging) return;
    this.dragDistance += Math.hypot(event.movementX, event.movementY);
    this.theta -= event.movementX * 0.008;
    this.phi = Math.max(0.35, Math.min(1.45, this.phi + event.movementY * 0.006));
    this.updateCamera();
    this.paint();
  };

  private dragging = false;

  private readonly onPointerDown = (event: PointerEvent): void => { this.dragging = true; this.dragDistance = 0; this.canvas?.setPointerCapture(event.pointerId); };
  private readonly onPointerUp = (event: PointerEvent): void => { this.dragging = false; this.suppressNextClick = this.dragDistance > 4; if (this.canvas?.hasPointerCapture(event.pointerId) === true) this.canvas.releasePointerCapture(event.pointerId); };
  private readonly onPointerCancel = (): void => { this.dragging = false; this.suppressNextClick = this.dragDistance > 4; };
  private readonly onContextLostEvent = (event: Event): void => { event.preventDefault(); this.dragging = false; this.onContextLost?.(new Error("renderer.webgl-context-lost")); };
  private readonly onContextRestoredEvent = (): void => { this.resize(); this.paint(); this.onContextRestored?.(); };
  private readonly onWheel = (event: WheelEvent): void => {
    this.radius = Math.max(4, Math.min(18, this.radius + event.deltaY * 0.01));
    this.updateCamera();
    this.paint();
  };

  public constructor(options: ThreeRendererOptions = {}) {
    this.onPick = options.onPick;
    this.onContextLost = options.onContextLost;
    this.onContextRestored = options.onContextRestored;
    this.scene.background = new THREE.Color(0x0d1516);
    this.scene.add(this.environmentRoot, this.buildRoot, this.socketRoot);
    this.camera.position.set(7, 5, 8);
    this.updateCamera();
  }

  public mount(host: HTMLElement): void {
    if (this.canvas !== undefined || this.disposed) return;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viewport-canvas";
    host.replaceChildren(this.canvas);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      this.resize();
      activeRendererCount += 1;
    } catch (error) {
      this.renderer = undefined;
      host.replaceChildren();
      this.canvas = undefined;
      throw new Error("renderer.webgl-initialization-failed", { cause: error });
    }
    this.canvas.addEventListener("click", this.onCanvasClick);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("lostpointercapture", this.onPointerCancel);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("webglcontextlost", this.onContextLostEvent);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestoredEvent);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.resize);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.paint();
  }

  public setEnvironment(environment: SimulationEnvironment): void {
    this.currentSpawn = environment.spawn;
    this.clearPayloadVisual();
    this.disposeObjectChildren(this.environmentRoot);
    const ambient = new THREE.HemisphereLight(0xc8e6e3, 0x111827, 1.8);
    this.environmentRoot.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff1c7, 2.2);
    sun.position.set(4, 9, -4);
    this.environmentRoot.add(sun);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(environment.ground.halfExtents[0] * 2, environment.ground.halfExtents[1] * 2, environment.ground.halfExtents[2] * 2), new THREE.MeshStandardMaterial({ color: 0x263a38, roughness: 0.92 }));
    ground.position.set(...environment.ground.position);
    ground.userData.semantic = "ground";
    this.environmentRoot.add(ground);
    if (environment.ramp !== undefined) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(environment.ramp.halfExtents[0] * 2, environment.ramp.halfExtents[1] * 2, environment.ramp.halfExtents[2] * 2), new THREE.MeshStandardMaterial({ color: 0x7b6249, roughness: 0.85 }));
      ramp.position.set(...environment.ramp.position);
      ramp.quaternion.set(...quaternionFromEuler(environment.ramp.rotation));
      ramp.userData.semantic = "ramp";
      this.environmentRoot.add(ramp);
    }
    if (environment.obstacles !== undefined) {
      for (const obs of environment.obstacles) {
        let geom: THREE.BufferGeometry;
        if (obs.shape === "cuboid") {
          const extents = obs.halfExtents ?? [1, 1, 1];
          geom = new THREE.BoxGeometry(extents[0] * 2, extents[1] * 2, extents[2] * 2);
        } else {
          geom = new THREE.CylinderGeometry(obs.radius ?? 0.5, obs.radius ?? 0.5, (obs.halfHeight ?? 1) * 2, 16);
        }
        const mat = new THREE.MeshStandardMaterial({ color: obs.color ?? 0xd97706, roughness: 0.6, metalness: 0.1 });
        const meshObj = new THREE.Mesh(geom, mat);
        meshObj.position.set(...obs.position);
        if (obs.rotation !== undefined) meshObj.quaternion.set(...quaternionFromEuler(obs.rotation));
        meshObj.userData.semantic = obs.semantic ?? "obstacle";
        this.environmentRoot.add(meshObj);
      }
    }

    // Start Zone / Starting Line marker at environment.spawn
    const spawnPos = environment.spawn;
    const startPad = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 0.08, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x0d9488, emissiveIntensity: 0.45, roughness: 0.4 })
    );
    startPad.position.set(spawnPos[0], spawnPos[1] - 0.74, spawnPos[2]);
    startPad.userData.semantic = "start-pad";

    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.65, roughness: 0.2 })
    );
    startLine.position.set(spawnPos[0], spawnPos[1] - 0.72, spawnPos[2] + 1.4);

    const startPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2);
    const startPoleMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.5 });
    const leftStartPole = new THREE.Mesh(startPoleGeo, startPoleMat);
    leftStartPole.position.set(spawnPos[0] - 2.5, spawnPos[1] + 0.85, spawnPos[2]);
    const rightStartPole = new THREE.Mesh(startPoleGeo, startPoleMat);
    rightStartPole.position.set(spawnPos[0] + 2.5, spawnPos[1] + 0.85, spawnPos[2]);

    const startBannerGeo = new THREE.BoxGeometry(5.0, 0.55, 0.1);
    const startBannerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.45 });
    const startBanner = new THREE.Mesh(startBannerGeo, startBannerMat);
    startBanner.position.set(spawnPos[0], spawnPos[1] + 2.3, spawnPos[2]);

    this.environmentRoot.add(startPad, startLine, leftStartPole, rightStartPole, startBanner);

    if (environment.goalZone !== undefined) {
      const finishPad = new THREE.Mesh(
        new THREE.BoxGeometry(environment.goalZone.size[0], 0.1, environment.goalZone.size[2]),
        new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.5, roughness: 0.3 })
      );
      finishPad.position.set(environment.goalZone.position[0], environment.goalZone.position[1] - 0.05, environment.goalZone.position[2]);
      this.environmentRoot.add(finishPad);

      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5 });
      const leftPole = new THREE.Mesh(poleGeo, poleMat);
      leftPole.position.set(environment.goalZone.position[0] - environment.goalZone.size[0] / 2, environment.goalZone.position[1] + 1.75, environment.goalZone.position[2]);
      const rightPole = new THREE.Mesh(poleGeo, poleMat);
      rightPole.position.set(environment.goalZone.position[0] + environment.goalZone.size[0] / 2, environment.goalZone.position[1] + 1.75, environment.goalZone.position[2]);

      const bannerGeo = new THREE.BoxGeometry(environment.goalZone.size[0], 0.6, 0.1);
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.3 });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(environment.goalZone.position[0], environment.goalZone.position[1] + 3.2, environment.goalZone.position[2]);

      this.environmentRoot.add(leftPole, rightPole, banner);
    }
    const grid = new THREE.GridHelper(28, 28, 0x53726b, 0x294542);
    grid.position.y = 0.01;
    this.environmentRoot.add(grid);
    if (environment.payload !== undefined) {
      const factory = this.visualRegistry.get(environment.payload.definitionId);
      if (factory !== undefined) {
        const visual = factory.create("A");
        visual.root.position.set(...environment.payload.position);
        visual.root.quaternion.set(...quaternionFromEuler(environment.payload.rotation));
        visual.root.userData.partId = environment.payload.id;
        visual.root.userData.definitionId = environment.payload.definitionId;
        visual.root.traverse((object) => { object.userData.partId = environment.payload?.id; });
        this.payloadVisual = visual;
        this.payloadId = environment.payload.id;
        this.environmentRoot.add(visual.root);
      }
    }
    this.paint();
  }

  public setBlueprint(blueprint: MachineBlueprint, catalog: RuntimePartCatalog, variants: Readonly<Record<string, string>> = {}): void {
    const firstPart = blueprint.parts[0];
    const spawnOffset: Vector3Tuple = firstPart === undefined
      ? this.currentSpawn
      : [
          this.currentSpawn[0] - firstPart.transform.position[0],
          this.currentSpawn[1] - firstPart.transform.position[1],
          this.currentSpawn[2] - firstPart.transform.position[2],
        ];
    this.buildRoot.position.set(...spawnOffset);
    this.socketRoot.position.set(...spawnOffset);
    this.followedPartId = firstPart === undefined ? undefined : String(firstPart.id);
    if (firstPart !== undefined) {
      this.followedPosition.set(
        firstPart.transform.position[0] + spawnOffset[0],
        firstPart.transform.position[1] + spawnOffset[1],
        firstPart.transform.position[2] + spawnOffset[2]
      );
    }
    this.socketRoot.visible = true;
    this.lastFrame = undefined;
    for (const [partId, variant] of Object.entries(variants)) this.variants.set(partId, variant);
    this.clearPartVisuals();
    for (const part of blueprint.parts) {
      const factory = this.visualRegistry.get(part.definitionId);
      if (factory === undefined) continue;
      const instance = factory.create(this.variants.get(String(part.id)) ?? this.variants.get(part.definitionId) ?? "A");
      instance.root.userData.partId = String(part.id);
      instance.root.userData.definitionId = part.definitionId;
      instance.root.position.set(...part.transform.position);
      instance.root.quaternion.set(...quaternionFromEuler(part.transform.rotation));
      instance.root.traverse((object) => { object.userData.partId = String(part.id); });
      this.visuals.set(String(part.id), instance);
      this.partRoots.set(String(part.id), instance.root);
      this.buildRoot.add(instance.root);
    }
    this.updateSocketMarkers(blueprint, catalog);
    this.fitCameraToBlueprint(blueprint);
    this.paint();
  }

  public setSocketHighlights(keys: readonly string[]): void {
    const highlighted = new Set(keys);
    for (const [key, marker] of this.socketMarkers) {
      const material = marker.material as THREE.MeshBasicMaterial;
      material.color.set(highlighted.has(key) ? 0xffc857 : 0x5cc8bf);
      material.opacity = highlighted.has(key) ? 1 : 0.72;
    }
    this.paint();
  }

  public setSelection(partId: string | undefined): void {
    this.clearSelectionHighlight();
    for (const [id, root] of this.partRoots) root.traverse((object) => { object.userData.selected = id === partId; });
    if (partId === undefined) { this.paint(); return; }
    const root = this.partRoots.get(partId);
    if (root === undefined) { this.paint(); return; }
    root.updateWorldMatrix(true, true);
    const highlight = new THREE.BoxHelper(root, 0xff4d57);
    const material = highlight.material;
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.95;
    highlight.renderOrder = 100;
    this.selectionHighlight = highlight;
    this.scene.add(highlight);
    this.paint();
  }

  public setGhost(ghost: GhostPlacement | undefined): void {
    if (this.ghost !== undefined && this.ghostRoot !== undefined) {
      this.buildRoot.remove(this.ghostRoot);
      this.ghost.dispose();
    }
    this.ghost = undefined;
    this.ghostRoot = undefined;
    if (ghost !== undefined) {
      const factory = this.visualRegistry.get(ghost.definitionId);
      if (factory !== undefined) {
        const instance = factory.create(this.variants.get(ghost.partId) ?? this.variants.get(ghost.definitionId) ?? "A");
        configureGhost(instance.root, ghost.valid);
        instance.root.position.set(...ghost.transform.position);
        instance.root.quaternion.set(...quaternionFromEuler(ghost.transform.rotation));
        this.buildRoot.add(instance.root);
        this.ghost = instance;
        this.ghostRoot = instance.root;
      }
    }
    this.paint();
  }

  public render(frame: SimulationFrame): void {
    this.lastFrame = frame;
    this.socketRoot.visible = false;
    this.buildRoot.position.set(0, 0, 0);
    this.socketRoot.position.set(0, 0, 0);
    const followed = this.followedPartId === undefined ? undefined : frame.transforms[this.followedPartId];
    if (followed !== undefined) {
      const position = new THREE.Vector3(...followed.position);
      this.cameraTarget.add(position.clone().sub(this.followedPosition));
      this.followedPosition.copy(position);
      this.updateCamera();
    }
    for (const [partId, transform] of Object.entries(frame.transforms)) {
      const root = partId === this.payloadId ? this.payloadVisual?.root : this.partRoots.get(partId);
      if (root === undefined) continue;
      root.position.set(...transform.position);
      root.quaternion.set(...transform.rotation);
    }
    this.paint();
  }

  public resize = (): void => {
    if (this.canvas === undefined) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? 640);
    const height = Math.max(1, parent?.clientHeight ?? 480);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
    this.paint();
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPartVisuals();
    this.setGhost(undefined);
    this.clearPayloadVisual();
    this.disposeObjectChildren(this.environmentRoot);
    this.disposeObjectChildren(this.socketRoot);
    this.socketMarkers.clear();
    if (this.canvas !== undefined) {
      this.canvas.removeEventListener("click", this.onCanvasClick);
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
      this.canvas.removeEventListener("lostpointercapture", this.onPointerCancel);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("webglcontextlost", this.onContextLostEvent);
      this.canvas.removeEventListener("webglcontextrestored", this.onContextRestoredEvent);
      this.canvas.removeEventListener("wheel", this.onWheel);
    }
    window.removeEventListener("resize", this.resize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.renderer !== undefined) {
      this.renderer.dispose();
      activeRendererCount = Math.max(0, activeRendererCount - 1);
    }
    this.renderer = undefined;
    this.canvas = undefined;
  }

  public static getActiveRendererCount(): number { return activeRendererCount; }

  public getResourceStats(): { readonly geometries: number; readonly textures: number } {
    return this.renderer === undefined ? { geometries: 0, textures: 0 } : { geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures };
  }

  public getCanvas(): HTMLCanvasElement | undefined { return this.canvas; }

  public getLastFrame(): SimulationFrame | undefined { return this.lastFrame; }

  private updateSocketMarkers(blueprint: MachineBlueprint, catalog: RuntimePartCatalog): void {
    this.disposeObjectChildren(this.socketRoot);
    this.socketMarkers.clear();
    for (const part of blueprint.parts) {
      const definition = catalog.get(part.definitionId);
      if (definition === undefined) continue;
      for (const socket of definition.sockets) {
        const frame = worldSocketFrame(part.transform, socket);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5cc8bf, transparent: true, opacity: 0.72 }));
        marker.position.set(...frame.position);
        marker.userData.socketId = socket.id;
        marker.userData.partId = String(part.id);
        this.socketRoot.add(marker);
        this.socketMarkers.set(`${String(part.id)}::${socket.id}`, marker);
      }
    }
  }

  private clearPartVisuals(): void {
    this.clearSelectionHighlight();
    for (const visual of this.visuals.values()) {
      this.buildRoot.remove(visual.root);
      visual.dispose();
    }
    this.visuals.clear();
    this.partRoots.clear();
    this.socketMarkers.clear();
  }

  private clearSelectionHighlight(): void {
    if (this.selectionHighlight === undefined) return;
    this.scene.remove(this.selectionHighlight);
    this.selectionHighlight.geometry.dispose();
    (this.selectionHighlight.material as THREE.Material).dispose();
    this.selectionHighlight = undefined;
  }

  private clearPayloadVisual(): void {
    if (this.payloadVisual !== undefined) {
      this.environmentRoot.remove(this.payloadVisual.root);
      this.payloadVisual.dispose();
    }
    this.payloadVisual = undefined;
    this.payloadId = undefined;
  }

  private disposeObjectChildren(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
        const renderable = object as THREE.Mesh | THREE.Line | THREE.Points;
        renderable.geometry.dispose();
        const material = renderable.material;
        if (Array.isArray(material)) for (const item of material) item.dispose();
        else material.dispose();
      });
    }
  }

  private updateCamera(): void {
    const x = Math.sin(this.theta) * Math.cos(this.phi) * this.radius;
    const y = Math.sin(this.phi) * this.radius;
    const z = Math.cos(this.theta) * Math.cos(this.phi) * this.radius;
    this.camera.position.set(x + this.cameraTarget.x, y + this.cameraTarget.y, z + this.cameraTarget.z);
    this.camera.lookAt(this.cameraTarget);
  }

  public resetCamera(): void {
    this.theta = 2.79;
    this.phi = 0.52;
    this.updateCamera();
    this.paint();
  }

  private fitCameraToBlueprint(blueprint: MachineBlueprint): void {
    const root = blueprint.parts[0];
    const offsetX = root === undefined ? this.currentSpawn[0] : this.currentSpawn[0] - root.transform.position[0];
    const offsetY = root === undefined ? this.currentSpawn[1] : this.currentSpawn[1] - root.transform.position[1];
    const offsetZ = root === undefined ? this.currentSpawn[2] : this.currentSpawn[2] - root.transform.position[2];

    if (blueprint.parts.length === 0) {
      this.cameraTarget.set(this.currentSpawn[0], this.currentSpawn[1], this.currentSpawn[2]);
      this.radius = 9.5;
      this.updateCamera();
      return;
    }
    const xs = blueprint.parts.map((part) => part.transform.position[0]);
    const ys = blueprint.parts.map((part) => part.transform.position[1]);
    const zs = blueprint.parts.map((part) => part.transform.position[2]);
    const minX = Math.min(...xs) - 1.4;
    const maxX = Math.max(...xs) + 1.4;
    const minZ = Math.min(...zs) - 1.4;
    const maxZ = Math.max(...zs) + 1.4;
    const span = Math.max(maxX - minX, maxZ - minZ, 3.5);
    this.cameraTarget.set((minX + maxX) / 2 + offsetX, Math.max(0.65, Math.min(1.25, Math.min(...ys) + 0.25)) + offsetY, (minZ + maxZ) / 2 + offsetZ);
    this.radius = Math.max(7, Math.min(18, span * 1.55 + 3));
    this.updateCamera();
  }

  private paint(): void {
    if (this.renderer !== undefined) this.renderer.render(this.scene, this.camera);
  }
}
