import * as THREE from "three";
import type { MachineBlueprint } from "../../building/domain/contracts";
import { worldSocketFrame, quaternionFromEuler } from "../../kernel/math";
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
  private disposed = false;
  private theta = 0.65;
  private phi = 1.0;
  private radius = 9;
  private readonly cameraTarget = new THREE.Vector3(0, 1, 0);
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
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(environment.ramp.halfExtents[0] * 2, environment.ramp.halfExtents[1] * 2, environment.ramp.halfExtents[2] * 2), new THREE.MeshStandardMaterial({ color: 0x7b6249, roughness: 0.85 }));
    ramp.position.set(...environment.ramp.position);
    ramp.quaternion.set(...quaternionFromEuler(environment.ramp.rotation));
    ramp.userData.semantic = "ramp";
    this.environmentRoot.add(ramp);
    const grid = new THREE.GridHelper(28, 28, 0x53726b, 0x294542);
    grid.position.y = 0.01;
    this.environmentRoot.add(grid);
    this.paint();
  }

  public setBlueprint(blueprint: MachineBlueprint, catalog: RuntimePartCatalog, variants: Readonly<Record<string, string>> = {}): void {
    const firstPart = blueprint.parts[0];
    this.followedPartId = firstPart === undefined ? undefined : String(firstPart.id);
    if (firstPart !== undefined) this.followedPosition.set(...firstPart.transform.position);
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
    for (const [id, root] of this.partRoots) root.traverse((object) => { object.userData.selected = id === partId; });
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
    const followed = this.followedPartId === undefined ? undefined : frame.transforms[this.followedPartId];
    if (followed !== undefined) {
      const position = new THREE.Vector3(...followed.position);
      this.cameraTarget.add(position.clone().sub(this.followedPosition));
      this.followedPosition.copy(position);
      this.updateCamera();
    }
    for (const [partId, transform] of Object.entries(frame.transforms)) {
      const root = this.partRoots.get(partId);
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
    for (const visual of this.visuals.values()) {
      this.buildRoot.remove(visual.root);
      visual.dispose();
    }
    this.visuals.clear();
    this.partRoots.clear();
    this.socketMarkers.clear();
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

  private fitCameraToBlueprint(blueprint: MachineBlueprint): void {
    if (blueprint.parts.length === 0) {
      this.cameraTarget.set(0, 1, 0);
      this.radius = 9;
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
    this.cameraTarget.set((minX + maxX) / 2, Math.max(0.65, Math.min(1.25, Math.min(...ys) + 0.25)), (minZ + maxZ) / 2);
    this.radius = Math.max(7, Math.min(18, span * 1.55 + 3));
    this.updateCamera();
  }

  private paint(): void {
    if (this.renderer !== undefined) this.renderer.render(this.scene, this.camera);
  }
}
