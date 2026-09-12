import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createBatteryBoxModel } from "./visual.generated";

export const batteryBoxVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.battery-box",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createBatteryBoxModel({ variant: variant === "B" ? "B" : "A" });
    normalizeGeneratedRoot(root);
    let disposed = false;
    return {
      root,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        disposeGroup(root);
      },
    };
  },
};
