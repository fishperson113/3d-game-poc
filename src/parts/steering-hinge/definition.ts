import type { PartDefinition } from "../../building/domain/part-definition";

export const steeringHingeDefinition: PartDefinition = {
  id: "core.steering-hinge",
  version: 1,
  sockets: [],
  capabilities: ["core.steering"],
};

// TODO(plan-04): Add mount sockets, joint contract, collider and generated visual.
