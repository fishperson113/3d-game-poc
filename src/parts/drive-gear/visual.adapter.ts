import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createDriveGearModel } from "./visual.generated";

export const driveGearVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.drive-gear",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createDriveGearModel({ variant: variant === "B" ? "B" : "A" });
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
