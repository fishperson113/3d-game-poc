import type { Vector3Tuple } from "./index";

export interface TransformLike {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
}

export interface SocketLike {
  readonly position: Vector3Tuple;
  readonly rotation?: Vector3Tuple;
}

export type QuaternionTuple = readonly [number, number, number, number];

export interface SocketFrame {
  readonly position: Vector3Tuple;
  readonly rotation: QuaternionTuple;
}

const IDENTITY: QuaternionTuple = [0, 0, 0, 1];

export function quaternionFromEuler(rotation: Vector3Tuple): QuaternionTuple {
  const [x, y, z] = rotation;
  const cx = Math.cos(x / 2); const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2); const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2); const sz = Math.sin(z / 2);
  return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
}

export function quaternionMultiply(left: QuaternionTuple, right: QuaternionTuple): QuaternionTuple {
  const [ax, ay, az, aw] = left; const [bx, by, bz, bw] = right;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function quaternionConjugate(value: QuaternionTuple): QuaternionTuple {
  return [-value[0], -value[1], -value[2], value[3]];
}

export function quaternionNormalize(value: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  return length === 0 ? IDENTITY : [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

export function rotateVector(rotation: QuaternionTuple, value: Vector3Tuple): Vector3Tuple {
  const qValue: QuaternionTuple = [value[0], value[1], value[2], 0];
  const result = quaternionMultiply(quaternionMultiply(rotation, qValue), quaternionConjugate(rotation));
  return [result[0], result[1], result[2]];
}

export function addVector(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function subtractVector(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function worldSocketFrame(transform: TransformLike, socket: SocketLike): SocketFrame {
  const partRotation = quaternionFromEuler(transform.rotation);
  const socketRotation = quaternionFromEuler(socket.rotation ?? [0, 0, 0]);
  return {
    position: addVector(transform.position, rotateVector(partRotation, socket.position)),
    rotation: quaternionNormalize(quaternionMultiply(partRotation, socketRotation)),
  };
}

export function eulerFromQuaternion(value: QuaternionTuple): Vector3Tuple {
  const [x, y, z, w] = quaternionNormalize(value);
  const sinr = 2 * (w * x + y * z);
  const cosr = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr, cosr);
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  return [roll, pitch, Math.atan2(siny, cosy)];
}

export function snapPartTransform(target: SocketFrame, sourceSocket: SocketLike, quarterTurns = 0): TransformLike {
  const mating = quaternionFromEuler([0, Math.PI + quarterTurns * Math.PI / 2, 0]);
  const sourceLocal = quaternionFromEuler(sourceSocket.rotation ?? [0, 0, 0]);
  const rotation = quaternionNormalize(quaternionMultiply(quaternionMultiply(target.rotation, mating), quaternionConjugate(sourceLocal)));
  const sourceOffset = rotateVector(rotation, sourceSocket.position);
  return { position: subtractVector(target.position, sourceOffset), rotation: eulerFromQuaternion(rotation) };
}

export function tupleDistance(left: Vector3Tuple, right: Vector3Tuple): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
