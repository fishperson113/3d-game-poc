import type { PartDefinition } from "../building/domain/part-definition";
import type { PartCatalog } from "../building/ports/part-catalog";
import { poweredWheelDefinition } from "./powered-wheel/definition";
import { steeringHingeDefinition } from "./steering-hinge/definition";
import { structuralBlockDefinition } from "./structural-block/definition";

const definitions: readonly PartDefinition[] = [
  structuralBlockDefinition,
  poweredWheelDefinition,
  steeringHingeDefinition,
];

export class StaticPartCatalog implements PartCatalog {
  public get(partDefinitionId: string): PartDefinition | undefined {
    // TODO(plan-04): Validate manifests before registration and index by ID.
    return definitions.find((definition) => definition.id === partDefinitionId);
  }
}
