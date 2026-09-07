import type { LoadedLevel } from "../../challenge/domain/contracts";
import type { LevelRepository, LevelSummary } from "../../challenge/ports/level-repository";

export class BundledLevelRepository implements LevelRepository {
  public async list(signal?: AbortSignal): Promise<readonly LevelSummary[]> {
    // TODO(plan-03): Fetch and validate /content/levels/index.json.
    void signal;
    return Promise.resolve([]);
  }

  public async get(levelId: string, signal?: AbortSignal): Promise<LoadedLevel> {
    // TODO(plan-03): Resolve, migrate and atomically validate level + landscape documents.
    void levelId;
    void signal;
    return Promise.reject(new Error("TODO(plan-03): BundledLevelRepository.get"));
  }
}
