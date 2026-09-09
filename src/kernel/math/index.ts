export type Vector3Tuple = readonly [number, number, number];

export interface TransformSnapshot {
  readonly position: Vector3Tuple;
  readonly rotation: readonly [number, number, number, number];
}

export type { QuaternionTuple, SocketFrame, SocketLike, TransformLike } from "./transform";
export { addVector, eulerFromQuaternion, quaternionConjugate, quaternionFromEuler, quaternionMultiply, quaternionNormalize, rotateVector, snapPartTransform, subtractVector, tupleDistance, worldSocketFrame } from "./transform";

// Building owns command-level finite-number and stepped-rotation validation.
