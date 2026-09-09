import structuralRaw from "./structural-block/manifest.json";
import wheelRaw from "./powered-wheel/manifest.json";
import hingeRaw from "./steering-hinge/manifest.json";
import { describe, expect, it } from "vitest";
import { parsePartManifest } from "./manifest";
import { StaticPartCatalog } from "./catalog";

describe("authoritative part manifests", () => {
  it("validates all three runtime manifests with stable visual variants", () => {
    const manifests = [structuralRaw, wheelRaw, hingeRaw].map((raw) => parsePartManifest(raw));
    expect(manifests.every((result) => result.ok)).toBe(true);
    for (const result of manifests) {
      if (!result.ok) continue;
      expect(result.value.visual.variants.map((variant) => variant.id)).toEqual(["A", "B"]);
      expect(result.value.visual.normalization).toEqual({ metersPerUnit: 1, upAxis: "y", forwardAxis: "z", origin: "part-frame" });
      expect(result.value.assembly.sockets.length).toBeGreaterThan(0);
      expect(result.value.physics.colliders.length).toBeGreaterThan(0);
    }
  });

  it("rejects duplicate socket ids and invalid visual normalization", () => {
    const mutatedSocket = structuredClone(structuralRaw) as unknown as { assembly: { sockets: Array<Record<string, unknown>> } };
    mutatedSocket.assembly.sockets = [...mutatedSocket.assembly.sockets, { ...mutatedSocket.assembly.sockets[0] }];
    const socketResult = parsePartManifest(mutatedSocket);
    expect(socketResult).toMatchObject({ ok: false, error: { code: "part.manifest.duplicate-socket" } });

    const mutatedVisual = structuredClone(structuralRaw) as unknown as { visual: { normalization: Record<string, unknown> } };
    mutatedVisual.visual.normalization = { metersPerUnit: 2, upAxis: "y", forwardAxis: "z", origin: "part-frame" };
    const visualResult = parsePartManifest(mutatedVisual);
    expect(visualResult).toMatchObject({ ok: false, error: { code: "part.manifest.invalid-normalization" } });
  });

  it("registers the catalog atomically after every manifest has passed", () => {
    const catalog = new StaticPartCatalog();
    expect(catalog.listManifests()).toHaveLength(3);
    expect(catalog.get("core.structural-block")).toBeDefined();
    expect(catalog.getPhysics("core.powered-wheel")?.actuator?.kind).toBe("wheel");
    expect(catalog.getVisual("core.steering-hinge")?.variants).toHaveLength(2);
  });
});
