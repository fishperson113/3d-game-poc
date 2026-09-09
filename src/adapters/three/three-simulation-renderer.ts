import * as THREE from "three";
import type { MachineBlueprint } from "../../building/domain/contracts";
import { worldSocketFrame } from "../../kernel/math";
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
  private lastFrame: SimulationFrame | undefined;
  private readonly onPick: ((partId: string) => void) | undefined;

  private readonly onCanvasClick = (event: MouseEvent): void => {
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
    this.theta -= event.movementX * 0.008;
    this.phi = Math.max(0.35, Math.min(1.45, this.phi + event.movementY * 0.006));
    this.updateCamera();
    this.paint();
  };

  private dragging = false;

  private readonly onPointerDown = (): void => { this.dragging = true; };
  private readonly onPointerUp = (): void => { this.dragging = false; };
  private readonly onWheel = (event: WheelEvent): void => {
    this.radius = Math.max(4, Math.min(18, this.radius + event.deltaY * 0.01));
    this.updateCamera();
    this.paint();
  };

  public constructor(options: ThreeRendererOptions = {}) {
    this.onPick = options.onPick;
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
    } catch {
      this.renderer = undefined;
    }
    this.canvas.addEventListener("click", this.onCanvasClick);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.resize);
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
    ramp.rotation.set(...environment.ramp.rotation);
    ramp.userData.semantic = "ramp";
    this.environmentRoot.add(ramp);
    const grid = new THREE.GridHelper(28, 28, 0x53726b, 0x294542);
    grid.position.y = 0.01;
    this.environmentRoot.add(grid);
    this.paint();
  }

  public setBlueprint(blueprint: MachineBlueprint, catalog: RuntimePartCatalog, variants: Readonly<Record<string, string>> = {}): void {
    for (const [partId, variant] of Object.entries(variants)) this.variants.set(partId, variant);
    this.clearPartVisuals();
    for (const part of blueprint.parts) {
      const factory = this.visualRegistry.get(part.definitionId);
      if (factory === undefined) continue;
      const instance = factory.create(this.variants.get(String(part.id)) ?? this.variants.get(part.definitionId) ?? "A");
      instance.root.userData.partId = String(part.id);
      instance.root.userData.definitionId = part.definitionId;
      instance.root.position.set(...part.transform.position);
      instance.root.rotation.set(...part.transform.rotation);
      instance.root.traverse((object) => { object.userData.partId = String(part.id); });
      this.visuals.set(String(part.id), instance);
      this.partRoots.set(String(part.id), instance.root);
      this.buildRoot.add(instance.root);
    }
    this.updateSocketMarkers(blueprint, catalog);
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
        instance.root.rotation.set(...ghost.transform.rotation);
        this.buildRoot.add(instance.root);
        this.ghost = instance;
        this.ghostRoot = instance.root;
      }
    }
    this.paint();
  }

  public render(frame: SimulationFrame): void {
    this.lastFrame = frame;
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
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPartVisuals();
    this.setGhost(undefined);
    this.disposeObjectChildren(this.environmentRoot);
    if (this.canvas !== undefined) {
      this.canvas.removeEventListener("click", this.onCanvasClick);
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("wheel", this.onWheel);
    }
    window.removeEventListener("resize", this.resize);
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
    for (const part of blueprint.parts) {
      const definition = catalog.get(part.definitionId);
      if (definition === undefined) continue;
      for (const socket of definition.sockets) {
        const frame = worldSocketFrame(part.transform, socket);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5cc8bf }));
        marker.position.set(...frame.position);
        marker.userData.socketId = socket.id;
        marker.userData.partId = String(part.id);
        this.socketRoot.add(marker);
      }
    }
  }

  private clearPartVisuals(): void {
    for (const visual of this.visuals.values()) visual.dispose();
    this.visuals.clear();
    this.partRoots.clear();
    this.disposeObjectChildren(this.buildRoot);
  }

  private disposeObjectChildren(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const renderable = object as THREE.Mesh;
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
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 1, 0);
  }

  private paint(): void {
    if (this.renderer !== undefined) this.renderer.render(this.scene, this.camera);
  }
}
