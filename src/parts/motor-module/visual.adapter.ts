import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createMotorModuleModel } from "./visual.generated";

export const motorModuleVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.motor-module",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createMotorModuleModel({ variant: variant === "B" ? "B" : "A" });
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
