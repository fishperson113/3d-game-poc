import type { PhysicsWorld } from "../../simulation/ports/physics-world";

export class RapierPhysicsWorld implements PhysicsWorld {
  public step(timestepSeconds: number): void {
    // TODO(plan-05): Delegate to an owned Rapier world initialized once at bootstrap.
    void timestepSeconds;
  }

  public dispose(): void {
    // TODO(plan-05): Free Rapier world resources and invalidate runtime handles.
  }
}
