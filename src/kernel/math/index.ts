export type Vector3Tuple = readonly [number, number, number];

export interface TransformSnapshot {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
}

// TODO(plan-02): Add finite-number and 90-degree rotation guards.
