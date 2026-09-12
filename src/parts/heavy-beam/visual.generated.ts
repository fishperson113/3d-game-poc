import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createHeavyBeamModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "heavy-beam-visual";
  const variant = options.variant ?? "A";
  if (variant === "A") {
    // Solid long beam with tech accents
    const body = mesh(new THREE.BoxGeometry(2, 0.5, 5), material(0x2563eb, 0.5, 0.3), "body");
    root.add(body);
    const accent = material(0xfbbf24, 0.4, 0.2);
    for (const x of [-0.75, 0.75]) {
      for (const z of [-2, -1, 0, 1, 2]) {
        const bolt = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), accent, "bolt");
        bolt.position.set(x, 0.28, z);
        root.add(bolt);
      }
    }
  } else {
    // Truss beam with cross-bracing
    const dark = material(0x1e3a8a, 0.5, 0.3);
    const orange = material(0xf97316, 0.4, 0.2);
    // 4 longitudinal rails
    for (const x of [-0.88, 0.88]) {
      for (const y of [-0.18, 0.18]) {
        const rail = mesh(new THREE.BoxGeometry(0.14, 0.14, 4.8), dark, "rail");
        rail.position.set(x, y, 0);
        root.add(rail);
      }
    }
    // Cross ties
    for (let z = -2; z <= 2; z += 1) {
      const tie = mesh(new THREE.BoxGeometry(1.9, 0.46, 0.14), orange, "tie");
      tie.position.set(0, 0, z);
      root.add(tie);
    }
  }
  return root;
}
