import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createStructuralBlockModel } from "./visual.generated";

export const structuralBlockVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.structural-block",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createStructuralBlockModel({ variant: variant === "B" ? "B" : "A" });
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
