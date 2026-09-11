import type { PartVisualFactory, PartVisualInstance, VisualVariant } from "../../adapters/three/part-visual";
import { disposeGroup, normalizeGeneratedRoot } from "../../adapters/three/part-visual";
import { createCrawlerTrackModel } from "./visual.generated";

export const crawlerTrackVisualFactory: PartVisualFactory = {
  partDefinitionId: "core.crawler-track",
  create(variant: VisualVariant = "A"): PartVisualInstance {
    const root = createCrawlerTrackModel({ variant: variant === "B" ? "B" : "A" });
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
