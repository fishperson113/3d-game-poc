import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createBatteryBoxModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "battery-box-visual";
  const variant = options.variant ?? "A";
  if (variant === "A") {
    // Cyber tech yellow-green battery box
    const body = mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), material(0x10b981, 0.5, 0.2), "body");
    root.add(body);
    // Battery terminals (+ and -)
    const terminalPos = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12), material(0xef4444, 0.3, 0.5), "term-pos");
    terminalPos.position.set(-0.35, 0.35, -0.35);
    const terminalNeg = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12), material(0x3b82f6, 0.3, 0.5), "term-neg");
    terminalNeg.position.set(0.35, 0.35, -0.35);
    // LED charge bar
    const led = mesh(new THREE.BoxGeometry(0.7, 0.08, 0.05), material(0xfbbf24, 0.2, 0.8), "led-bar");
    led.position.set(0, 0.1, 0.62);
    root.add(terminalPos, terminalNeg, led);
  } else {
    // Heavy cast iron weight block
    const body = mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), material(0x374151, 0.6, 0.6), "weight-body");
    const handle = mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), material(0xf59e0b, 0.4, 0.4), "handle");
    handle.position.set(0, 0.35, 0);
    handle.rotation.x = Math.PI / 2;
    root.add(body, handle);
  }
  return root;
}
