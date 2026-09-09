// Generated-style procedural output from art-source/parts/powered-wheel/brief.md.
// The pinned img2threejs checkout is recorded in manifest.json; the current source has no external image reference.
import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createPoweredWheelModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "powered-wheel-visual";
  const variant = options.variant ?? "A";
  const tyre = mesh(new THREE.CylinderGeometry(0.48, 0.48, variant === "A" ? 0.36 : 0.28, 16), material(variant === "A" ? 0x20272a : 0x1b3038, 0.82, 0.04), "tyre");
  tyre.rotation.z = Math.PI / 2;
  root.add(tyre);
  const hub = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.44, 12), material(variant === "A" ? 0x7bd3cc : 0xf0b35a, 0.34, 0.7), "hub");
  hub.rotation.z = Math.PI / 2;
  root.add(hub);
  if (variant === "A") {
    const ring = mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 16), material(0x79d6cf, 0.35, 0.55), "hub-ring");
    ring.rotation.y = Math.PI / 2;
    root.add(ring);
  } else {
    const spokeMaterial = material(0xe0a95e, 0.4, 0.6);
    for (let index = 0; index < 6; index += 1) {
      const spoke = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.34), spokeMaterial, "spoke");
      spoke.rotation.x = index * Math.PI / 3;
      spoke.position.x = 0;
      root.add(spoke);
    }
  }
  return root;
}
