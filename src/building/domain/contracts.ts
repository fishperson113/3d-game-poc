export type Vector3Tuple = readonly [number, number, number];

export interface PartTransform {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
}

export interface PartInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly transform: PartTransform;
}

export interface MachineBlueprint {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly parts: readonly PartInstance[];
  readonly connections: readonly unknown[];
  readonly controlBindings: readonly unknown[];
}
