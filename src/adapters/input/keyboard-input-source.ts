import type { ControlState, InputSource } from "../../simulation/ports/input-source";

export class KeyboardInputSource implements InputSource {
  public read(): ControlState {
    // TODO(plan-05): Normalize keyboard state and clear it on blur/visibility change.
    return { throttle: 0, steering: 0 };
  }

  public dispose(): void {
    // TODO(plan-05): Remove keyboard and lifecycle listeners.
  }
}
