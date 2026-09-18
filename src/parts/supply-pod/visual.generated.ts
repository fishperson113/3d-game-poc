import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createSupplyPodModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "supply-pod-visual";
  const rescueOrange = options.variant === "B" ? 0xf97316 : 0xf59e0b;
  const shell = mesh(new THREE.BoxGeometry(1.04, 0.64, 1.04), material(rescueOrange, 0.58, 0.08), "pod-shell");
  const lid = mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), material(0xf8fafc, 0.42, 0.12), "pod-lid");
  lid.position.y = 0.34;
  const bandMaterial = material(0x2563eb, 0.4, 0.18);
  const bandX = mesh(new THREE.BoxGeometry(0.16, 0.68, 1.08), bandMaterial, "safety-band-x");
  const bandZ = mesh(new THREE.BoxGeometry(1.08, 0.68, 0.16), bandMaterial, "safety-band-z");
  const waterBadge = mesh(new THREE.CircleGeometry(0.17, 20), material(0x38bdf8, 0.25, 0.15), "water-filter-badge");
  waterBadge.position.set(0, 0, 0.526);
  const handle = mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 18, Math.PI), material(0x334155, 0.45, 0.3), "carry-handle");
  handle.position.set(0, 0.45, 0);
  handle.rotation.z = Math.PI;
  root.add(shell, lid, bandX, bandZ, waterBadge, handle);
  return root;
}
