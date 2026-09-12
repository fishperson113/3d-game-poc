import { describe, expect, it } from "vitest";
import { StaticPartCatalog } from "../../parts";
import { asMachineId, asPartId, type MachineBlueprint } from "../domain/contracts";
import { Machine } from "../domain/machine";
import { findPlacementCandidates, rootTransform, validatePlacementCandidate } from "./assembly-solver";
import { validateAttachment } from "../domain/attachment-validator";

describe("Component-to-Module Attachment Validation (Ma trận tương thích cơ khí)", () => {
  const catalog = new StaticPartCatalog();

  function requirePart(defId: string) {
    const part = catalog.get(defId);
    if (part === undefined) throw new Error(`Missing part ${defId}`);
    return part;
  }

  function requireSocket(def: ReturnType<typeof requirePart>, socketId: string) {
    const socket = def.sockets.find((s) => s.id === socketId);
    if (socket === undefined) throw new Error(`Missing socket ${socketId} on ${def.id}`);
    return socket;
  }

  const chassisDef = requirePart("core.structural-block");
  const beamDef = requirePart("core.heavy-beam");
  const wheelDef = requirePart("core.powered-wheel");
  const trackDef = requirePart("core.crawler-track");
  const hingeDef = requirePart("core.steering-hinge");
  const motorDef = requirePart("core.motor-module");
  const gearDef = requirePart("core.drive-gear");
  const batteryDef = requirePart("core.battery-box");

  const getSocket = (def: ReturnType<typeof requirePart>, socketId: string) => requireSocket(def, socketId);

  describe("1. Powered Wheel & Crawler Track (Bánh xe & Băng xích)", () => {
    it("cho phép gắn bánh xe vào trục bánh của khung (mount-*)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), chassisDef, getSocket(chassisDef, "mount-front-left"));
      expect(result.valid).toBe(true);
    });

    it("chặn gắn bánh xe lên nóc khung xe (frame-top)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), chassisDef, getSocket(chassisDef, "frame-top"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-roof");
      expect(result.reason).toContain("không thể gắn lên nóc xe");
    });

    it("chặn gắn bánh xe dưới gầm xe (frame-bottom)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), chassisDef, getSocket(chassisDef, "frame-bottom"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-bottom");
      expect(result.reason).toContain("không thể gắn dưới gầm xe");
    });

    it("chặn gắn bánh xe vào cản trước/sau của khung xe (frame-front/frame-rear)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), chassisDef, getSocket(chassisDef, "frame-front"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-frame-position");
    });

    it("chặn gắn bánh xe lên hộp pin (battery-box)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), batteryDef, getSocket(batteryDef, "mount-front"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-target");
    });

    it("cho phép gắn bánh xe vào trục của khớp lái (steering-hinge.axle)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), hingeDef, getSocket(hingeDef, "axle"));
      expect(result.valid).toBe(true);
    });

    it("cho phép gắn bánh xe vào trục của động cơ (motor-module.axle)", () => {
      const result = validateAttachment(wheelDef, getSocket(wheelDef, "axle"), motorDef, getSocket(motorDef, "axle"));
      expect(result.valid).toBe(true);
    });

    it("tương tự với băng xích (crawler-track): chặn nóc xe, cho phép trục bánh", () => {
      expect(validateAttachment(trackDef, getSocket(trackDef, "axle"), chassisDef, getSocket(chassisDef, "frame-top")).valid).toBe(false);
      expect(validateAttachment(trackDef, getSocket(trackDef, "axle"), chassisDef, getSocket(chassisDef, "mount-rear-right")).valid).toBe(true);
    });
  });

  describe("2. Steering Hinge (Khớp bẻ lái)", () => {
    it("cho phép gắn khớp lái vào vị trí trục bánh trước/sau (mount-*)", () => {
      const result = validateAttachment(hingeDef, getSocket(hingeDef, "mount"), chassisDef, getSocket(chassisDef, "mount-front-left"));
      expect(result.valid).toBe(true);
    });

    it("chặn gắn khớp lái lên nóc hoặc cản xe", () => {
      const result = validateAttachment(hingeDef, getSocket(hingeDef, "mount"), chassisDef, getSocket(chassisDef, "frame-top"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-frame-position");
    });

    it("chặn gắn chồng khớp lái lên trục khớp lái khác (hinge onto hinge)", () => {
      const result = validateAttachment(hingeDef, getSocket(hingeDef, "mount"), hingeDef, getSocket(hingeDef, "axle"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-target");
    });

    it("chặn gắn khớp lái ở trục giữa xe (heavy-beam.mount-mid-*)", () => {
      const result = validateAttachment(hingeDef, getSocket(hingeDef, "mount"), beamDef, getSocket(beamDef, "mount-mid-left"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-mid-steering");
      expect(result.reason).toContain("không nên gắn ở trục giữa xe");
    });
  });

  describe("3. Drive Gear (Bánh răng trợ lực)", () => {
    it("cho phép gắn bánh răng ở cản trước (frame-front) làm bánh răng leo tường", () => {
      const result = validateAttachment(gearDef, getSocket(gearDef, "axle"), chassisDef, getSocket(chassisDef, "frame-front"));
      expect(result.valid).toBe(true);
    });

    it("cho phép gắn bánh răng ở vị trí bánh xe bên hông (mount-*)", () => {
      const result = validateAttachment(gearDef, getSocket(gearDef, "axle"), chassisDef, getSocket(chassisDef, "mount-rear-left"));
      expect(result.valid).toBe(true);
    });

    it("chặn gắn bánh răng lên nóc xe", () => {
      const result = validateAttachment(gearDef, getSocket(gearDef, "axle"), chassisDef, getSocket(chassisDef, "frame-top"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-frame-position");
    });
  });

  describe("4. Battery Box (Hộp pin trọng tâm)", () => {
    it("cho phép gắn hộp pin lên nóc khung xe (frame-top)", () => {
      const result = validateAttachment(batteryDef, getSocket(batteryDef, "mount-bottom"), chassisDef, getSocket(chassisDef, "frame-top"));
      expect(result.valid).toBe(true);
    });

    it("cho phép gắn hộp pin làm đối trọng cản sau (frame-rear)", () => {
      const result = validateAttachment(batteryDef, getSocket(batteryDef, "mount-front"), chassisDef, getSocket(chassisDef, "frame-rear"));
      expect(result.valid).toBe(true);
    });

    it("chặn gắn hộp pin vào vị trí trục bánh xe (mount-*)", () => {
      const result = validateAttachment(batteryDef, getSocket(batteryDef, "mount-bottom"), chassisDef, getSocket(chassisDef, "mount-front-left"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-wheel-mount");
      expect(result.reason).toContain("không thể treo ở vị trí trục bánh xe");
    });

    it("chặn gắn hộp pin dưới gầm xe (frame-bottom)", () => {
      const result = validateAttachment(batteryDef, getSocket(batteryDef, "mount-bottom"), chassisDef, getSocket(chassisDef, "frame-bottom"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-bottom");
    });
  });

  describe("5. Structural Block & Heavy Beam (Khung dầm)", () => {
    it("cho phép liên kết khung dầm qua các cổng khung (frame-front, frame-rear, frame-top)", () => {
      expect(validateAttachment(chassisDef, getSocket(chassisDef, "frame-rear"), chassisDef, getSocket(chassisDef, "frame-front")).valid).toBe(true);
      expect(validateAttachment(beamDef, getSocket(beamDef, "frame-front"), chassisDef, getSocket(chassisDef, "frame-rear")).valid).toBe(true);
    });

    it("chặn liên kết khung xe vào ngàm bánh xe của khung khác", () => {
      const result = validateAttachment(chassisDef, getSocket(chassisDef, "frame-front"), chassisDef, getSocket(chassisDef, "mount-front-left"));
      expect(result.valid).toBe(false);
      expect(result.code).toBe("building.attachment.invalid-wheel-mount");
    });
  });

  describe("6. Bộ Lọc Ứng Viên Gắn (findPlacementCandidates)", () => {
    const singleBlockBlueprint: MachineBlueprint = {
      schemaVersion: 1,
      id: asMachineId("test-filter"),
      version: 0,
      parts: [{ id: asPartId("chassis"), definitionId: "core.structural-block", transform: rootTransform() }],
      connections: [],
      controlBindings: [],
    };

    it("khi tìm vị trí cho bánh xe, chỉ trả về các cổng mount-* (không có frame-top, frame-bottom, frame-front)", () => {
      const candidates = findPlacementCandidates(singleBlockBlueprint, "core.powered-wheel", catalog);
      expect(candidates.length).toBe(4);
      expect(candidates.every((c) => c.targetSocketId.startsWith("mount-"))).toBe(true);
      expect(candidates.some((c) => c.targetSocketId === "frame-top")).toBe(false);
      expect(candidates.some((c) => c.targetSocketId === "frame-bottom")).toBe(false);
    });

    it("khi tìm vị trí cho hộp pin, chỉ trả về các cổng frame-top, frame-front, frame-rear (không có mount-*)", () => {
      const candidates = findPlacementCandidates(singleBlockBlueprint, "core.battery-box", catalog);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.every((c) => !c.targetSocketId.startsWith("mount-"))).toBe(true);
      expect(candidates.some((c) => c.targetSocketId === "frame-top")).toBe(true);
    });
  });

  describe("7. Kiểm Tra Hướng Xoay (validatePlacementCandidate)", () => {
    const blueprint: MachineBlueprint = {
      schemaVersion: 1,
      id: asMachineId("test-rotation"),
      version: 0,
      parts: [{ id: asPartId("chassis"), definitionId: "core.structural-block", transform: rootTransform() }],
      connections: [],
      controlBindings: [],
    };

    it("bánh xe quay đúng hướng (0 vòng xoay) là hợp lệ", () => {
      const candidate = { targetPartId: "chassis", targetSocketId: "mount-front-left", sourceSocketId: "axle", transform: rootTransform() };
      const val = validatePlacementCandidate(blueprint, "core.powered-wheel", candidate, catalog, 0);
      expect(val.valid).toBe(true);
    });

    it("bánh xe xoay 90° (quarterTurns = 1) bị cảnh báo sai hướng", () => {
      const candidate = { targetPartId: "chassis", targetSocketId: "mount-front-left", sourceSocketId: "axle", transform: rootTransform() };
      const val = validatePlacementCandidate(blueprint, "core.powered-wheel", candidate, catalog, 1);
      expect(val.valid).toBe(false);
      expect(val.code).toBe("building.placement.invalid-wheel-angle");
      expect(val.reason).toContain("xoay ngang (90°)");
    });

    it("khớp bẻ lái xoay 180° (quarterTurns = 2) bị cảnh báo quay ngược vào thân xe", () => {
      const candidate = { targetPartId: "chassis", targetSocketId: "mount-front-left", sourceSocketId: "mount", transform: rootTransform() };
      const val = validatePlacementCandidate(blueprint, "core.steering-hinge", candidate, catalog, 2);
      expect(val.valid).toBe(false);
      expect(val.code).toBe("building.placement.inward-steering");
      expect(val.reason).toContain("quay ngược vào thân xe");
    });
  });

  describe("8. Domain Machine.connectParts() Chặn Lắp Ráp Phi Vật Lý", () => {
    it("từ chối kết nối bánh xe lên nóc xe và trả về lỗi attachment chi tiết", () => {
      const createRes = Machine.create("machine-test", { resolvePart: (id) => catalog.get(id) });
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;
      const machine = createRes.value;
      machine.addPart({ id: "chassis", definitionId: "core.structural-block", transform: rootTransform() });
      machine.addPart({ id: "wheel-bad", definitionId: "core.powered-wheel", transform: rootTransform() });

      const connectRes = machine.connectParts({
        id: "bad-conn",
        a: { partId: "chassis", socketId: "frame-top" },
        b: { partId: "wheel-bad", socketId: "axle" },
        joint: { type: "revolute", axis: [1, 0, 0] },
      });

      expect(connectRes.ok).toBe(false);
      if (!connectRes.ok) {
        expect(connectRes.error.code).toBe("building.attachment.invalid-roof");
      }
    });

    it("từ chối kết nối hộp pin vào vị trí trục bánh xe", () => {
      const createRes = Machine.create("machine-test-2", { resolvePart: (id) => catalog.get(id) });
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;
      const machine = createRes.value;
      machine.addPart({ id: "chassis", definitionId: "core.structural-block", transform: rootTransform() });
      machine.addPart({ id: "battery-bad", definitionId: "core.battery-box", transform: rootTransform() });

      const connectRes = machine.connectParts({
        id: "bad-battery-conn",
        a: { partId: "chassis", socketId: "mount-front-left" },
        b: { partId: "battery-bad", socketId: "mount-bottom" },
        joint: { type: "fixed" },
      });

      expect(connectRes.ok).toBe(false);
      if (!connectRes.ok) {
        expect(connectRes.error.code).toBe("building.attachment.invalid-wheel-mount");
      }
    });
  });
});
