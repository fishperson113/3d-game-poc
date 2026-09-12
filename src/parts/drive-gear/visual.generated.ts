import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createDriveGearModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "drive-gear-visual";
  const variant = options.variant ?? "A";
  
  const gearColor = variant === "A" ? 0xb45309 : 0x64748b;

  // Central hub & disk
  const disk = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.16, 20), material(gearColor, 0.4, 0.5), "hub");
  disk.rotation.z = Math.PI / 2;
  root.add(disk);

  // 12 Gear teeth around the perimeter
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const tooth = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), material(gearColor, 0.4, 0.5), `tooth-${String(i)}`);
    tooth.position.set(0, Math.sin(angle) * 0.42, Math.cos(angle) * 0.42);
    tooth.rotation.x = -angle;
    root.add(tooth);
  }

  // Axle center hole accent
  const centerPin = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 12), material(0x1e293b, 0.2, 0.8), "pin");
  centerPin.rotation.z = Math.PI / 2;
  root.add(centerPin);

  return root;
}
