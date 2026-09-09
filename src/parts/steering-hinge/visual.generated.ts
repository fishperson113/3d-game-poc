// Generated-style procedural output from art-source/parts/steering-hinge/brief.md.
// The pinned img2threejs checkout is recorded in manifest.json; the current source has no external image reference.
import * as THREE from "three";
import { cylinderBetween, material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createSteeringHingeModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "steering-hinge-visual";
  const dark = material(0x26373f, 0.58, 0.4);
  const accent = material(options.variant === "B" ? 0x63c9c0 : 0xf0a53a, 0.32, 0.62);
  const steel = material(0xb7c5c8, 0.28, 0.76);
  if (options.variant === "B") {
    for (const z of [-0.1, 0.1]) {
      const cheek = mesh(new THREE.BoxGeometry(0.4, 0.1, 0.08), dark, "fork-cheek");
      cheek.position.set(0, 0, z);
      root.add(cheek);
    }
  } else {
    const arm = mesh(new THREE.BoxGeometry(0.4, 0.16, 0.16), dark, "knuckle-arm");
    root.add(arm);
  }
  const pin = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.54, 16), accent, "steering-kingpin");
  pin.position.x = -0.2;
  root.add(pin);
  for (const y of [-0.29, 0.29]) {
    const cap = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), accent, "kingpin-cap");
    cap.position.set(-0.2, y, 0);
    root.add(cap);
  }
  const axle = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 12), steel, "axle-stub");
  axle.rotation.z = Math.PI / 2;
  axle.position.x = 0.27;
  root.add(axle);
  const steeringTab = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.3), accent, "steering-tab");
  steeringTab.position.set(-0.12, 0.06, 0.15);
  root.add(steeringTab);
  root.add(cylinderBetween(new THREE.Vector3(-0.12, 0.06, 0.25), new THREE.Vector3(0.12, 0.06, 0.08), 0.035, accent, "knuckle-brace"));
  return root;
}
