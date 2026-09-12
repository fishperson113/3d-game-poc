import type { PartVisualFactory } from "../adapters/three/part-visual";
import { poweredWheelVisualFactory } from "./powered-wheel/visual.adapter";
import { steeringHingeVisualFactory } from "./steering-hinge/visual.adapter";
import { structuralBlockVisualFactory } from "./structural-block/visual.adapter";
import { heavyBeamVisualFactory } from "./heavy-beam/visual.adapter";
import { batteryBoxVisualFactory } from "./battery-box/visual.adapter";
import { crawlerTrackVisualFactory } from "./crawler-track/visual.adapter";
import { motorModuleVisualFactory } from "./motor-module/visual.adapter";
import { driveGearVisualFactory } from "./drive-gear/visual.adapter";

const factories: Readonly<Record<string, PartVisualFactory>> = Object.freeze({
  "core.structural-block": structuralBlockVisualFactory,
  "core.powered-wheel": poweredWheelVisualFactory,
  "core.steering-hinge": steeringHingeVisualFactory,
  "core.heavy-beam": heavyBeamVisualFactory,
  "core.battery-box": batteryBoxVisualFactory,
  "core.crawler-track": crawlerTrackVisualFactory,
  "core.motor-module": motorModuleVisualFactory,
  "core.drive-gear": driveGearVisualFactory,
});

export class PartVisualRegistry {
  public get(partDefinitionId: string): PartVisualFactory | undefined {
    return factories[partDefinitionId];
  }
}
