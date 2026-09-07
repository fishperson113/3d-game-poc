import type { EventLogService } from "../../event-log/application/event-log-service";

export class EventLogController {
  public constructor(private readonly eventLog: EventLogService) {}

  public mount(host: HTMLElement): void {
    // TODO(plan-05): Render generic envelope filters and JSON export controls.
    void host;
    void this.eventLog;
  }

  public dispose(): void {
    // TODO(plan-05): Unsubscribe from the memory sink.
  }
}
