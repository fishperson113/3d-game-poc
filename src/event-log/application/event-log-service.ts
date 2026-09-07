import type { EventEnvelope } from "../../kernel/events/contracts";
import type { EventLogSink } from "../ports/event-log-sink";

export class EventLogService {
  public constructor(private readonly sinks: readonly EventLogSink[]) {}

  public record(event: EventEnvelope): void {
    // TODO(plan-01): Add isolation, registry validation, filtering and redaction.
    for (const sink of this.sinks) sink.write(event);
  }
}
