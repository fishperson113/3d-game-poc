import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createMotorModuleModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "motor-module-visual";
  const variant = options.variant ?? "A";
  
  const motorColor = variant === "A" ? 0xea580c : 0xd97706;

  // Main motor casing
  const casing = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16), material(motorColor, 0.4, 0.4), "casing");
  casing.rotation.z = Math.PI / 2;
  root.add(casing);

  // Cooling fins
  for (let i = -0.15; i <= 0.15; i += 0.08) {
    const fin = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16), material(0x334155, 0.3, 0.6), "cooling-fin");
    fin.rotation.z = Math.PI / 2;
    fin.position.x = i;
    root.add(fin);
  }

  // Output axle shaft
  const shaft = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 12), material(0x94a3b8, 0.2, 0.8), "shaft");
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.35;
  root.add(shaft);

  return root;
}
