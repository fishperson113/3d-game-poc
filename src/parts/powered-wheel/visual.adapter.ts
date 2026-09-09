import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createPoweredWheelModel } from "./visual.generated";

export const poweredWheelVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.powered-wheel",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createPoweredWheelModel({ variant: variant === "B" ? "B" : "A" });
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
