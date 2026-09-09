import type { PartDefinition } from "../building/domain/part-definition";
import type { PartCatalog } from "../building/ports/part-catalog";
import { parsePartManifest, projectPartDefinition, type PartManifest, type PartPhysicsDefinition, type PartVisualReference } from "./manifest";
import structuralRaw from "./structural-block/manifest.json";
import wheelRaw from "./powered-wheel/manifest.json";
import hingeRaw from "./steering-hinge/manifest.json";

const rawManifests: readonly unknown[] = [structuralRaw, wheelRaw, hingeRaw];

export interface RuntimePartCatalog extends PartCatalog {
  getPhysics(partDefinitionId: string): PartPhysicsDefinition | undefined;
  getVisual(partDefinitionId: string): PartVisualReference | undefined;
  list(): readonly PartDefinition[];
  listManifests(): readonly PartManifest[];
}

export class StaticPartCatalog implements RuntimePartCatalog {
  private readonly manifests: readonly PartManifest[];
  private readonly definitions: readonly PartDefinition[];

  public constructor() {
    const manifests: PartManifest[] = [];
    for (const raw of rawManifests) {
      const parsed = parsePartManifest(raw);
      if (!parsed.ok) throw new Error(`${parsed.error.code} at ${parsed.error.path}`);
      if (manifests.some((manifest) => manifest.id === parsed.value.id)) throw new Error(`part.manifest.duplicate-id at ${parsed.value.id}`);
      manifests.push(parsed.value);
    }
    this.manifests = Object.freeze(manifests);
    this.definitions = Object.freeze(manifests.map(projectPartDefinition));
  }

  public get(partDefinitionId: string): PartDefinition | undefined {
    return this.definitions.find((definition) => definition.id === partDefinitionId);
  }

  public getPhysics(partDefinitionId: string): PartPhysicsDefinition | undefined {
    return this.manifests.find((manifest) => manifest.id === partDefinitionId)?.physics;
  }

  public getVisual(partDefinitionId: string): PartVisualReference | undefined {
    return this.manifests.find((manifest) => manifest.id === partDefinitionId)?.visual;
  }

  public list(): readonly PartDefinition[] {
    return this.definitions;
  }

  public listManifests(): readonly PartManifest[] {
    return this.manifests;
  }
}
