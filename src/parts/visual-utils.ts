import * as THREE from "three";

export function material(color: number, roughness = 0.62, metalness = 0.15): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function mesh(geometry: THREE.BufferGeometry, materialValue: THREE.Material, semantic: string): THREE.Mesh {
  const value = new THREE.Mesh(geometry, materialValue);
  value.userData.semantic = semantic;
  return value;
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

export function cylinderBetween(start: THREE.Vector3, end: THREE.Vector3, radius: number, materialValue: THREE.Material, semantic: string): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const result = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), materialValue, semantic);
  result.position.copy(start).add(end).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}
