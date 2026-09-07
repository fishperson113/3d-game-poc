export interface PhysicsWorld {
  step(timestepSeconds: number): void;
  dispose(): void;
}
