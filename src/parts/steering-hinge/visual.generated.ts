// Generated-style procedural output from art-source/parts/steering-hinge/brief.md.
// The pinned img2threejs checkout is recorded in manifest.json; the current source has no external image reference.
import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createSteeringHingeModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "steering-hinge-visual";
  const dark = material(0x35464e, 0.55, 0.35);
  const accent = material(options.variant === "B" ? 0x63c9c0 : 0xe3ae5a, 0.36, 0.55);
  if (options.variant === "B") {
    for (const x of [-0.16, 0.16]) {
      const cheek = mesh(new THREE.BoxGeometry(0.12, 0.42, 0.42), dark, "fork-cheek");
      cheek.position.x = x;
      root.add(cheek);
    }
  } else {
    root.add(mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), dark, "hinge-body"));
  }
  const pin = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), accent, "pivot-pin");
  root.add(pin);
  const cap = mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), accent, "top-cap");
  cap.position.y = 0.24;
  root.add(cap);
  return root;
}
