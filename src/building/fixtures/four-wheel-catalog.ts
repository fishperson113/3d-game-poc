import type { PartDefinition } from "../domain/part-definition";
import type { PartCatalog } from "../ports/part-catalog";

const socket = (id: string, accepts: readonly string[], tags: readonly string[], singleUse = true) => ({ id, accepts, tags, singleUse, position: [0, 0, 0] as [number, number, number] });

const definitions: readonly PartDefinition[] = [
  {
    id: "core.structural-block",
    version: 1,
    sockets: [
      socket("mount-front-left", ["mount"], ["mount"]), socket("mount-front-right", ["mount"], ["mount"]),
      socket("mount-rear-left", ["mount"], ["mount"]), socket("mount-rear-right", ["mount"], ["mount"]),
    ],
    capabilities: [],
  },
  {
    id: "core.steering-hinge",
    version: 1,
    sockets: [socket("mount", ["mount"], ["mount"]), socket("axle", ["axle"], ["axle"])],
    capabilities: ["core.steering"],
    configurationSchema: { fields: { steeringLimitRadians: { type: "number", default: 0.6, min: 0, max: 1.57 } } },
  },
  {
    id: "core.powered-wheel",
    version: 1,
    sockets: [socket("axle", ["mount", "axle"], ["mount", "axle"])],
    capabilities: ["core.motor-wheel"],
    configurationSchema: { fields: { motorTorque: { type: "number", default: 20, min: 0, max: 100 } } },
  },
];

/** Test-only catalog owned by Building; it does not depend on visual or physics assets. */
export class FourWheelFixtureCatalog implements PartCatalog {
  public get(partDefinitionId: string): PartDefinition | undefined {
    return definitions.find((definition) => definition.id === partDefinitionId);
  }
}
