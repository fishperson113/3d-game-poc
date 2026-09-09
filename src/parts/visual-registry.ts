import type { PartVisualFactory } from "../adapters/three/part-visual";
import { poweredWheelVisualFactory } from "./powered-wheel/visual.adapter";
import { steeringHingeVisualFactory } from "./steering-hinge/visual.adapter";
import { structuralBlockVisualFactory } from "./structural-block/visual.adapter";

const factories: Readonly<Record<string, PartVisualFactory>> = Object.freeze({
  "core.structural-block": structuralBlockVisualFactory,
  "core.powered-wheel": poweredWheelVisualFactory,
  "core.steering-hinge": steeringHingeVisualFactory,
});

export class PartVisualRegistry {
  public get(partDefinitionId: string): PartVisualFactory | undefined {
    return factories[partDefinitionId];
  }
}
