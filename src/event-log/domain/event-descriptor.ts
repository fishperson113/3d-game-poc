import type { JsonValue } from "../../kernel/json";

export interface EventDescriptor<TPayload = JsonValue> {
  readonly type: string;
  readonly version: number;
  parsePayload(input: unknown): TPayload;
  summarize(payload: TPayload): string;
  redact?(payload: TPayload): JsonValue;
}

// TODO(plan-01): Add upcaster registration without a central event union.
