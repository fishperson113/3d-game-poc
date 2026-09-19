export const APP_NAME = "CurioLab";
export const FIXED_TIMESTEP_SECONDS = 1 / 60;

export type RuntimeState =
  | "LoadingChallenge"
  | "Building"
  | "Compiling"
  | "Running"
  | "Completed"
  | "Failed";
