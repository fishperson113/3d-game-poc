import type { ControlState, InputSource } from "../../simulation/ports/input-source";
import type { RuntimeTelemetrySink } from "../../simulation/ports/runtime-telemetry";

const DRIVE_FORWARD = new Set(["KeyW", "ArrowUp"]);
const DRIVE_BACK = new Set(["KeyS", "ArrowDown"]);
const STEER_LEFT = new Set(["KeyA", "ArrowLeft"]);
const STEER_RIGHT = new Set(["KeyD", "ArrowRight"]);

let activeListenerCount = 0;

export interface KeyboardInputSourceOptions {
  readonly telemetry?: RuntimeTelemetrySink;
}

function isFormField(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.tagName === "SELECT" || element?.isContentEditable === true;
}

export class KeyboardInputSource implements InputSource {
  private readonly pressed = new Set<string>();
  private disposed = false;
  private readonly telemetry: RuntimeTelemetrySink | undefined;

  public constructor(options: KeyboardInputSourceOptions = {}) {
    this.telemetry = options.telemetry;
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    activeListenerCount += 4;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isFormField(event.target)) return;
    if (DRIVE_FORWARD.has(event.code) || DRIVE_BACK.has(event.code) || STEER_LEFT.has(event.code) || STEER_RIGHT.has(event.code)) {
      const wasPressed = this.pressed.has(event.code);
      this.pressed.add(event.code);
      if (!wasPressed) this.publishControlEvent("keydown", event.code);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.pressed.delete(event.code)) this.publishControlEvent("keyup", event.code);
  };

  private readonly onBlur = (): void => { this.resetWithReason("blur"); };
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") this.resetWithReason("visibility-hidden");
  };

  public read(): ControlState {
    const forward = [...DRIVE_FORWARD].some((key) => this.pressed.has(key));
    const reverse = [...DRIVE_BACK].some((key) => this.pressed.has(key));
    const left = [...STEER_LEFT].some((key) => this.pressed.has(key));
    const right = [...STEER_RIGHT].some((key) => this.pressed.has(key));
    return { throttle: Number(forward) - Number(reverse), steering: Number(right) - Number(left) };
  }

  public reset(): void { this.resetWithReason("manual"); }

  private resetWithReason(reason: "blur" | "visibility-hidden" | "manual" | "dispose"): void {
    if (this.pressed.size === 0) return;
    this.pressed.clear();
    this.publish({ type: "input.control.reset", payload: { source: "keyboard", reason, pressed: [], throttle: 0, steering: 0 }, severity: "debug", tags: ["input", "input.keyboard"] });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetWithReason("dispose");
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    activeListenerCount = Math.max(0, activeListenerCount - 4);
  }

  public static getActiveListenerCount(): number {
    return activeListenerCount;
  }

  private publishControlEvent(phase: "keydown" | "keyup", code: string): void {
    const controls = this.read();
    this.publish({ type: "input.control.changed", payload: { source: "keyboard", phase, code, pressed: [...this.pressed].sort(), throttle: controls.throttle, steering: controls.steering }, severity: "debug", tags: ["input", "input.keyboard"] });
  }

  private publish(event: Parameters<RuntimeTelemetrySink>[0]): void {
    try {
      this.telemetry?.(event);
    } catch {
      // Telemetry must never break input handling.
    }
  }
}
