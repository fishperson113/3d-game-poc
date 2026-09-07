import type { EventEnvelope } from "../../kernel/events/contracts";

export interface EventLogSink {
  write(event: EventEnvelope): void;
}
