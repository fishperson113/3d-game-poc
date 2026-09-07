export const APP_NAME = "Besiege-lite Web PoC";
export const FIXED_TIMESTEP_SECONDS = 1 / 60;

export type RuntimeState =
  | "LoadingChallenge"
  | "Building"
  | "Compiling"
  | "Running"
  | "Completed"
  | "Failed";
