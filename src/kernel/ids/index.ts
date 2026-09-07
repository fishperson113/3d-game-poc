export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type CorrelationId = Brand<string, "CorrelationId">;
export type MachineId = Brand<string, "MachineId">;
export type SimulationSessionId = Brand<string, "SimulationSessionId">;

// TODO(plan-01): Add injectable ID factories and UUID validation.
