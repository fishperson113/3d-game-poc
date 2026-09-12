import * as THREE from "three";
import { material, mesh } from "../visual-utils";

export interface GeneratedVisualOptions { readonly variant?: "A" | "B"; }

export function createCrawlerTrackModel(options: GeneratedVisualOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "crawler-track-visual";
  const variant = options.variant ?? "A";
  
  const treadColor = variant === "A" ? 0x1f2937 : 0x475569;
  const wheelColor = variant === "A" ? 0xf59e0b : 0xd97706;

  // Front sprocket wheel
  const frontWheel = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.38, 16), material(wheelColor, 0.5, 0.3), "front-wheel");
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(0, 0, 1.0);

  // Rear idler wheel
  const rearWheel = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.38, 16), material(wheelColor, 0.5, 0.3), "rear-wheel");
  rearWheel.rotation.z = Math.PI / 2;
  rearWheel.position.set(0, 0, -1.0);

  // 3 road wheels in the middle
  for (const z of [-0.45, 0, 0.45]) {
    const roadWheel = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12), material(0x6b7280, 0.4, 0.4), "road-wheel");
    roadWheel.rotation.z = Math.PI / 2;
    roadWheel.position.set(0, -0.06, z);
    root.add(roadWheel);
  }

  // Continuous track tread belt (top, bottom, and side bridges)
  const bottomTread = mesh(new THREE.BoxGeometry(0.42, 0.08, 2.0), material(treadColor, 0.7, 0.1), "tread-bottom");
  bottomTread.position.set(0, -0.32, 0);

  const topTread = mesh(new THREE.BoxGeometry(0.42, 0.08, 2.0), material(treadColor, 0.7, 0.1), "tread-top");
  topTread.position.set(0, 0.32, 0);

  // Structural bogie frame connecting wheels
  const frame = mesh(new THREE.BoxGeometry(0.08, 0.2, 2.1), material(0x111827, 0.6, 0.5), "bogie-frame");
  frame.position.set(0, 0, 0);

  root.add(frontWheel, rearWheel, bottomTread, topTread, frame);
  return root;
}
