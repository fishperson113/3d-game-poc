import type { EventPublisher } from "../../kernel/events/contracts";
import type { LoadedLevel } from "../domain/contracts";
import type { LevelRepository } from "../ports/level-repository";

export class LoadLevel {
  public constructor(
    private readonly repository: LevelRepository,
    private readonly events: EventPublisher,
  ) {}

  public async execute(levelId: string, signal?: AbortSignal): Promise<LoadedLevel> {
    // TODO(plan-03): Add validation lifecycle and correlated failure events.
    void this.events;
    return this.repository.get(levelId, signal);
  }
}
