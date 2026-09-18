import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createSupplyPodModel } from "./visual.generated";

export const supplyPodVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.supply-pod",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createSupplyPodModel({ variant: variant === "B" ? "B" : "A" });
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
