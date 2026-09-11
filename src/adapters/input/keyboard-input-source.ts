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

function normalizeControlKey(code: string, key: string): string | undefined {
  if (DRIVE_FORWARD.has(code) || key === "w" || key === "W" || key === "ư" || key === "Ư" || key === "ArrowUp") return "KeyW";
  if (DRIVE_BACK.has(code) || key === "s" || key === "S" || key === "ArrowDown") return "KeyS";
  if (STEER_LEFT.has(code) || key === "a" || key === "A" || key === "ArrowLeft") return "KeyA";
  if (STEER_RIGHT.has(code) || key === "d" || key === "D" || key === "đ" || key === "Đ" || key === "ArrowRight") return "KeyD";
  return undefined;
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
    const normalized = normalizeControlKey(event.code, event.key);
    if (normalized !== undefined) {
      const wasPressed = this.pressed.has(normalized);
      this.pressed.add(normalized);
      if (!wasPressed) this.publishControlEvent("keydown", normalized);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const normalized = normalizeControlKey(event.code, event.key);
    if (normalized !== undefined) {
      if (this.pressed.delete(normalized)) this.publishControlEvent("keyup", normalized);
    }
  };

  private readonly onBlur = (): void => { this.resetWithReason("blur"); };
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") this.resetWithReason("visibility-hidden");
  };

  private touchThrottle = 0;
  private touchSteering = 0;

  public setTouchThrottle(value: number): void {
    this.touchThrottle = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  }

  public setTouchSteering(value: number): void {
    this.touchSteering = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  }

  public read(): ControlState {
    const forward = [...DRIVE_FORWARD].some((key) => this.pressed.has(key));
    const reverse = [...DRIVE_BACK].some((key) => this.pressed.has(key));
    const left = [...STEER_LEFT].some((key) => this.pressed.has(key));
    const right = [...STEER_RIGHT].some((key) => this.pressed.has(key));
    const keyThrottle = Number(forward) - Number(reverse);
    // Steering direction viewed from the rear of the vehicle facing +Z:
    // +X is to the left of the driver/chase camera, -X is to the right.
    // Therefore Left press yields +1 steering, and Right press yields -1 steering.
    const keySteering = Number(left) - Number(right);
    return {
      throttle: this.touchThrottle !== 0 ? this.touchThrottle : keyThrottle,
      steering: this.touchSteering !== 0 ? this.touchSteering : keySteering,
    };
  }

  public reset(): void {
    this.touchThrottle = 0;
    this.touchSteering = 0;
    this.resetWithReason("manual");
  }

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
