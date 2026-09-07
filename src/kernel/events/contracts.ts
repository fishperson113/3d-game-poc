import type { JsonValue } from "../json";

export interface EventEnvelope<TType extends string = string, TPayload = JsonValue> {
  readonly id: string;
  readonly type: TType;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly observedAt: string;
  readonly sequence: number;
  readonly severity: "debug" | "info" | "warn" | "error";
  readonly producer: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly context: Readonly<Record<string, JsonValue>>;
  readonly tags?: readonly string[];
  readonly payload: TPayload;
}

export interface EventPublisher {
  publish(event: EventEnvelope): void;
  subscribe(pattern: string, handler: (event: EventEnvelope) => void): () => void;
}
