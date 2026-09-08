export type Vector3Tuple = readonly [number, number, number];

export interface TransformSnapshot {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
}

// Building owns command-level finite-number and stepped-rotation validation.
