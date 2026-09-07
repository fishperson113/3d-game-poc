import type { PartDefinition } from "../../building/domain/part-definition";

export const poweredWheelDefinition: PartDefinition = {
  id: "core.powered-wheel",
  version: 1,
  sockets: [],
  capabilities: ["core.motor-wheel"],
};

// TODO(plan-04): Add axle socket, collider, manifest and img2threejs visual.
