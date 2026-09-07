import type { TransformSnapshot } from "../../kernel/math";

export interface SimulationFrame {
  readonly step: number;
  readonly transforms: Readonly<Record<string, TransformSnapshot>>;
}

export interface SimulationRenderer {
  render(frame: SimulationFrame): void;
  dispose(): void;
}
