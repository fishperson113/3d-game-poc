import type { EventEnvelope } from "../../kernel/events/contracts";
import type { EventLogSink } from "../../event-log/ports/event-log-sink";

export class ConsoleEventLogSink implements EventLogSink {
  public write(event: EventEnvelope): void {
    // TODO(plan-01): Apply severity routing and descriptor-aware summaries.
    console.info(`[${event.type}]`, event);
  }
}
