import type { LoadedLevel } from "../domain/contracts";

export interface LevelSummary {
  readonly id: string;
  readonly title: string;
  readonly definitionUrl: string;
  readonly thumbnailUrl?: string;
}

export interface LevelRepository {
  list(signal?: AbortSignal): Promise<readonly LevelSummary[]>;
  get(levelId: string, signal?: AbortSignal): Promise<LoadedLevel>;
}
