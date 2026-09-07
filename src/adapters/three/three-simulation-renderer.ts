import * as THREE from "three";
import type { SimulationFrame, SimulationRenderer } from "../../simulation/ports/simulation-renderer";

export class ThreeSimulationRenderer implements SimulationRenderer {
  private readonly scene = new THREE.Scene();

  public render(frame: SimulationFrame): void {
    // TODO(plan-05): Sync transform snapshots to owned Object3D instances.
    void frame;
    void this.scene;
  }

  public dispose(): void {
    // TODO(plan-05): Dispose geometries, materials, textures and renderer ownership.
  }
}
