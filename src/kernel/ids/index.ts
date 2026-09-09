export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type CorrelationId = Brand<string, "CorrelationId">;
export type MachineId = Brand<string, "MachineId">;
export type SimulationSessionId = Brand<string, "SimulationSessionId">;

// Event IDs and correlation IDs are generated at the event boundary. The
// envelope factory accepts injectable generators so this shared type module
// remains free of runtime dependencies.
