export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

// TODO(plan-02): Add helpers only when command implementations need them.
