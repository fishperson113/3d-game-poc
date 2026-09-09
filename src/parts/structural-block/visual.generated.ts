// Generated-style procedural output from art-source/parts/structural-block/brief.md.
// The pinned img2threejs checkout is recorded in manifest.json; the current source has no external image reference.
import * as THREE from "three";
import { cylinderBetween, material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createStructuralBlockModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "structural-block-visual";
  const variant = options.variant ?? "A";
  if (variant === "A") {
    const body = mesh(new THREE.BoxGeometry(2, 0.5, 2.5), material(0x4d6b7a, 0.48, 0.35), "body");
    root.add(body);
    const accent = material(0x9fd36b, 0.4, 0.2);
    for (const x of [-0.72, 0.72]) for (const z of [-0.92, 0.92]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8), accent, "fastener");
      bolt.position.set(x, 0.28, z);
      root.add(bolt);
    }
  } else {
    const dark = material(0x31414a, 0.55, 0.3);
    const orange = material(0xd8874d, 0.42, 0.25);
    for (const x of [-0.88, 0.88]) for (const z of [-1.08, 1.08]) {
      const post = mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), dark, "frame-post");
      post.position.set(x, 0, z);
      root.add(post);
    }
    for (const z of [-1.08, 1.08]) root.add(mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), dark, "frame-rail")).position.z = z;
    for (const x of [-0.88, 0.88]) root.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 2.16), dark, "frame-rail")).position.x = x;
    root.add(cylinderBetween(new THREE.Vector3(-0.82, -0.16, -1), new THREE.Vector3(0.82, 0.16, 1), 0.07, orange, "brace"));
    root.add(cylinderBetween(new THREE.Vector3(-0.82, 0.16, 1), new THREE.Vector3(0.82, -0.16, -1), 0.07, orange, "brace"));
    root.add(mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), material(0x526f7c, 0.48, 0.3), "center-plate"));
  }
  return root;
}
