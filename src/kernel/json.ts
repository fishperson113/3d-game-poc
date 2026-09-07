export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export interface ContentDocument<TKind extends string, TData> {
  readonly schemaVersion: number;
  readonly kind: TKind;
  readonly id: string;
  readonly revision: number;
  readonly data: TData;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}
