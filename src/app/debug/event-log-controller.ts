import type { EventLogService } from "../../event-log/application/event-log-service";

export class EventLogController {
  private host: HTMLElement | undefined;

  public constructor(private readonly eventLog: EventLogService) {}

  public mount(host: HTMLElement): void {
    this.host = host;
    host.dataset.eventLogOwner = this.eventLog.constructor.name;
  }

  public dispose(): void {
    if (this.host !== undefined) delete this.host.dataset.eventLogOwner;
    this.host = undefined;
  }
}
