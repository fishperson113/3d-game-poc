import type { ContentDocument, JsonValue } from "../../kernel/json";
import type { Vector3Tuple } from "../../building/domain/contracts";

export interface TransformSpec {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
  readonly scale: Vector3Tuple;
}

export interface LandscapeObjectSpec {
  readonly id: string;
  readonly type: string;
  readonly transform: TransformSpec;
  readonly config: Readonly<Record<string, JsonValue>>;
}

export type LandscapeDocument = ContentDocument<"core.landscape", {
  readonly environment: { readonly background: string; readonly gravity: Vector3Tuple };
  readonly objects: readonly LandscapeObjectSpec[];
  readonly spawnPoints: readonly unknown[];
  readonly triggers: readonly unknown[];
}>;

export interface LoadedLevel {
  readonly id: string;
  readonly title: string;
  readonly landscape: LandscapeDocument;
}
