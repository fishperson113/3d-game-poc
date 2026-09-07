export interface ControlState {
  readonly throttle: number;
  readonly steering: number;
}

export interface InputSource {
  read(): ControlState;
  dispose(): void;
}
