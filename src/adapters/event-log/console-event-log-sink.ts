import type { EventEnvelope } from "../../kernel/events/contracts";
import type { EventLogSink } from "../../event-log/ports/event-log-sink";
import type { EventSchemaRegistry } from "../../event-log/domain/event-schema-registry";

export interface ConsoleWriter {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ConsoleEventLogSinkOptions {
  readonly console?: ConsoleWriter;
  readonly registry?: EventSchemaRegistry;
}

function defaultConsoleWriter(): ConsoleWriter {
  const runtime = globalThis as unknown as { readonly console?: ConsoleWriter };
  if (runtime.console === undefined) throw new Error("A console writer is required for the console event log sink.");
  return runtime.console;
}

export class ConsoleEventLogSink implements EventLogSink {
  private readonly output: ConsoleWriter;
  private readonly registry: EventSchemaRegistry | undefined;

  public constructor(options: ConsoleEventLogSinkOptions = {}) {
    this.output = options.console ?? defaultConsoleWriter();
    this.registry = options.registry;
  }

  public write(event: EventEnvelope): void {
    const projection = this.registry?.project(event);
    let summary = `event ${event.type}`;
    if (projection?.ok && projection.value.known && projection.value.descriptor !== undefined) {
      try {
        summary = projection.value.descriptor.summarize(projection.value.payload);
      } catch {
        summary = `event ${event.type}`;
      }
    }
    const message = `[${event.severity}] #${String(event.sequence)} ${event.type} correlation=${event.correlationId} ${summary}`;
    this.output[event.severity](message);
  }
}
