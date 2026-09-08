import type { PartDefinition } from "../../building/domain/part-definition";

export const structuralBlockDefinition: PartDefinition = {
  id: "core.structural-block",
  version: 1,
  sockets: [
    { id: "mount-front-left", accepts: ["mount"], tags: ["mount"], position: [-0.5, 0, 0.5] },
    { id: "mount-front-right", accepts: ["mount"], tags: ["mount"], position: [0.5, 0, 0.5] },
    { id: "mount-rear-left", accepts: ["mount"], tags: ["mount"], position: [-0.5, 0, -0.5] },
    { id: "mount-rear-right", accepts: ["mount"], tags: ["mount"], position: [0.5, 0, -0.5] },
    { id: "mount", accepts: ["mount"], tags: ["mount"], position: [0, 0, 0], singleUse: false },
  ],
  capabilities: [],
};

// TODO(plan-04): Add reviewed sockets, colliders, manifest and generated visual adapter.
