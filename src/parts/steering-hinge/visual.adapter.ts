import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createSteeringHingeModel } from "./visual.generated";

export const steeringHingeVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.steering-hinge",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createSteeringHingeModel({ variant: variant === "B" ? "B" : "A" });
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
