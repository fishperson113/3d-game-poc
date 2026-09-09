import type { JsonValue } from "../../kernel/json";

export type RuntimeTelemetrySeverity = "debug" | "info" | "warn" | "error";

export interface RuntimeTelemetryEvent {
  readonly type: string;
  readonly payload: JsonValue;
  readonly severity?: RuntimeTelemetrySeverity;
  readonly tags?: readonly string[];
}

export type RuntimeTelemetrySink = (event: RuntimeTelemetryEvent) => void;
