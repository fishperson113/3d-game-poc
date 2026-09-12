import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createHeavyBeamModel } from "./visual.generated";

export const heavyBeamVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.heavy-beam",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createHeavyBeamModel({ variant: variant === "B" ? "B" : "A" });
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
