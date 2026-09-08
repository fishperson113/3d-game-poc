import type { PartDefinition } from "../../building/domain/part-definition";

export const poweredWheelDefinition: PartDefinition = {
  id: "core.powered-wheel",
  version: 1,
  sockets: [{ id: "axle", accepts: ["mount", "axle"], tags: ["mount", "axle"], position: [0, 0, 0] }],
  capabilities: ["core.motor-wheel"],
  configurationSchema: {
    fields: {
      motorTorque: { type: "number", default: 20, min: 0, max: 100 },
    },
  },
};

// TODO(plan-04): Add axle socket, collider, manifest and img2threejs visual.
