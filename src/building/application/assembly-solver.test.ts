import { describe, expect, it } from "vitest";
import { StaticPartCatalog } from "../../parts";
import { asConnectionId, asMachineId, asPartId, type MachineBlueprint } from "../domain/contracts";
import { findPlacementCandidates, rootTransform } from "./assembly-solver";

describe("assembly placement ordering", () => {
  it("prefers free steering axles when adding powered wheels", () => {
    const blueprint: MachineBlueprint = {
      schemaVersion: 1,
      id: asMachineId("assembly-ordering"),
      version: 0,
      parts: [
        { id: asPartId("block-1"), definitionId: "core.structural-block", transform: rootTransform() },
        { id: asPartId("hinge-1"), definitionId: "core.steering-hinge", transform: { position: [-0.85, 0.5, 0.75], rotation: [0, 0, 0] } },
        { id: asPartId("hinge-2"), definitionId: "core.steering-hinge", transform: { position: [0.85, 0.5, 0.75], rotation: [0, 0, 0] } },
      ],
      connections: [
        { id: asConnectionId("hinge-1::block-1::mount-front-left"), a: { partId: asPartId("block-1"), socketId: "mount-front-left" }, b: { partId: asPartId("hinge-1"), socketId: "mount" }, joint: { type: "revolute", axis: [0, 1, 0], limits: [-0.6, 0.6] } },
        { id: asConnectionId("hinge-2::block-1::mount-front-right"), a: { partId: asPartId("block-1"), socketId: "mount-front-right" }, b: { partId: asPartId("hinge-2"), socketId: "mount" }, joint: { type: "revolute", axis: [0, 1, 0], limits: [-0.6, 0.6] } },
      ],
      controlBindings: [],
    };

    const candidates = findPlacementCandidates(blueprint, "core.powered-wheel", new StaticPartCatalog());
    expect(candidates.slice(0, 2).map((candidate) => `${candidate.targetPartId}:${candidate.targetSocketId}`)).toEqual(["hinge-1:axle", "hinge-2:axle"]);
  });
});
