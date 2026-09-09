import type { JsonValue } from "../json";

export interface EventInfrastructureError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export function eventError(
  code: string,
  message: string,
  path?: string,
  details?: Readonly<Record<string, JsonValue>>,
): EventInfrastructureError {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    ...(details === undefined ? {} : { details }),
  };
}
