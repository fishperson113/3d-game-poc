import type { PartDefinition } from "../domain/part-definition";

export interface PartCatalog {
  get(partDefinitionId: string): PartDefinition | undefined;
}
