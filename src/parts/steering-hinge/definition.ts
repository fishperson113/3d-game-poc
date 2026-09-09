import rawManifest from "./manifest.json";
import { parsePartManifest, projectPartDefinition } from "../manifest";

const parsed = parsePartManifest(rawManifest);
if (!parsed.ok) throw new Error(`${parsed.error.code} at ${parsed.error.path}`);
export const steeringHingeManifest = parsed.value;
export const steeringHingeDefinition = projectPartDefinition(steeringHingeManifest);
