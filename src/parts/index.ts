export { StaticPartCatalog } from "./catalog";
export type { RuntimePartCatalog } from "./catalog";
export { structuralBlockDefinition } from "./structural-block/definition";
export { poweredWheelDefinition } from "./powered-wheel/definition";
export { steeringHingeDefinition } from "./steering-hinge/definition";
export type { PartManifest, PartPhysicsDefinition, PartColliderDefinition, PartVisualReference, ParsedManifest, ManifestValidationError } from "./manifest";
export { parsePartManifest, projectPartDefinition, IMG2THREEJS_SOURCE_COMMIT } from "./manifest";
export { PartVisualRegistry } from "./visual-registry";
