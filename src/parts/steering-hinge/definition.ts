import type { PartDefinition } from "../../building/domain/part-definition";

export const steeringHingeDefinition: PartDefinition = {
  id: "core.steering-hinge",
  version: 1,
  sockets: [
    { id: "mount", accepts: ["mount"], tags: ["mount"], position: [0, 0, 0] },
    { id: "axle", accepts: ["axle"], tags: ["axle"], position: [0, 0, 0] },
  ],
  capabilities: ["core.steering"],
  configurationSchema: {
    fields: {
      steeringLimitRadians: { type: "number", default: 0.6, min: 0, max: 1.57 },
    },
  },
};

// TODO(plan-04): Add mount sockets, joint contract, collider and generated visual.
