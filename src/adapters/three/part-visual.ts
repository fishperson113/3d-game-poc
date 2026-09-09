import * as THREE from "three";

export type VisualVariant = string;

export interface PartVisualInstance {
  readonly root: THREE.Group;
  dispose(): void;
}

export interface PartVisualFactory {
  readonly partDefinitionId: string;
  readonly create: (variant?: VisualVariant) => PartVisualInstance;
}

export function normalizeGeneratedRoot(root: THREE.Group): void {
  // Generated meshes are normalized as a child of the semantic part visual.
  // The renderer owns the part-frame transform and never edits authoritative sockets.
  root.scale.set(1, 1, 1);
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
}

export function disposeGroup(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const renderable = object as THREE.Mesh;
    geometries.add(renderable.geometry);
    const materialValue = renderable.material;
    if (Array.isArray(materialValue)) for (const item of materialValue) materials.add(item);
    else materials.add(materialValue);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const materialValue of materials) materialValue.dispose();
}
