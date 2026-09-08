export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

// Keep the result contract small; command modules define domain-specific errors.
