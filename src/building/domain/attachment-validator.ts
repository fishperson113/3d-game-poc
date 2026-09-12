import type { PartDefinition, SocketDefinition } from "./part-definition";

export type PartMechanicalCategory =
  | "frame"
  | "wheel"
  | "track"
  | "steering"
  | "motor"
  | "gear"
  | "battery";

export interface AttachmentValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly code?: string;
}

export function getPartCategory(definitionId: string): PartMechanicalCategory {
  if (definitionId.includes("powered-wheel")) return "wheel";
  if (definitionId.includes("crawler-track")) return "track";
  if (definitionId.includes("steering-hinge")) return "steering";
  if (definitionId.includes("motor-module")) return "motor";
  if (definitionId.includes("drive-gear")) return "gear";
  if (definitionId.includes("battery-box")) return "battery";
  return "frame";
}

/**
 * Validates mechanical compatibility between a component (source) being mounted
 * onto an existing module (target) at specific sockets.
 */
export function validateAttachment(
  sourceDef: PartDefinition,
  sourceSocket: SocketDefinition,
  targetDef: PartDefinition,
  targetSocket: SocketDefinition
): AttachmentValidationResult {
  const sourceCat = getPartCategory(sourceDef.id);
  const targetCat = getPartCategory(targetDef.id);

  // 1. Powered Wheel or Crawler Track
  if (sourceCat === "wheel" || sourceCat === "track") {
    const partName = sourceCat === "wheel" ? "Bánh xe" : "Băng xích";
    if (targetCat === "frame") {
      if (!targetSocket.id.startsWith("mount-")) {
        if (targetSocket.id === "frame-top") {
          return { valid: false, code: "building.attachment.invalid-roof", reason: `${partName} không thể gắn lên nóc xe!` };
        }
        if (targetSocket.id === "frame-bottom") {
          return { valid: false, code: "building.attachment.invalid-bottom", reason: `${partName} không thể gắn dưới gầm xe!` };
        }
        return { valid: false, code: "building.attachment.invalid-frame-position", reason: `${partName} chỉ gắn vào trục bánh (mount-*), không thể gắn vào cản trước/sau!` };
      }
      return { valid: true };
    }
    if (targetCat === "steering" || targetCat === "motor") {
      if (targetSocket.id !== "axle") {
        return { valid: false, code: "building.attachment.invalid-socket", reason: `${partName} phải gắn vào trục xoay (axle) của ${targetCat === "steering" ? "khớp lái" : "động cơ"}!` };
      }
      return { valid: true };
    }
    return { valid: false, code: "building.attachment.invalid-target", reason: `${partName} chỉ có thể gắn vào trục bánh xe, khớp lái hoặc động cơ!` };
  }

  // 2. Steering Hinge
  if (sourceCat === "steering") {
    if (sourceSocket.id !== "mount") {
      return { valid: false, code: "building.attachment.invalid-source-socket", reason: "Khớp bẻ lái phải gắn bằng đế ngàm (mount), không thể gắn ngược bằng trục lái!" };
    }
    if (targetCat === "frame") {
      if (!targetSocket.id.startsWith("mount-")) {
        return { valid: false, code: "building.attachment.invalid-frame-position", reason: "Khớp bẻ lái chỉ gắn ở vị trí trục bánh (mount-*), không thể gắn lên nóc hay cản xe!" };
      }
      if (targetSocket.id.includes("mid")) {
        return { valid: false, code: "building.attachment.invalid-mid-steering", reason: "Khớp bẻ lái không nên gắn ở trục giữa xe để tránh mất ổn định lái!" };
      }
      return { valid: true };
    }
    return { valid: false, code: "building.attachment.invalid-target", reason: "Khớp bẻ lái chỉ có thể gắn vào ngàm trục bánh trên khung xe!" };
  }

  // 3. Drive Gear
  if (sourceCat === "gear") {
    if (targetCat === "frame") {
      if (targetSocket.id === "frame-front") {
        return { valid: true }; // Climbing gear at front bumper
      }
      if (targetSocket.id.startsWith("mount-")) {
        return { valid: true }; // Drive gear mounted on wheel well
      }
      return { valid: false, code: "building.attachment.invalid-frame-position", reason: "Bánh răng trợ lực chỉ gắn ở cản trước (leo tường) hoặc vị trí trục bánh xe!" };
    }
    if (targetCat === "steering" || targetCat === "motor") {
      if (targetSocket.id !== "axle") {
        return { valid: false, code: "building.attachment.invalid-socket", reason: "Bánh răng phải gắn vào trục xoay (axle)!" };
      }
      return { valid: true };
    }
    return { valid: false, code: "building.attachment.invalid-target", reason: "Bánh răng chỉ có thể gắn vào cản trước, trục bánh, khớp lái hoặc động cơ!" };
  }

  // 4. Battery Box
  if (sourceCat === "battery") {
    if (targetCat === "frame") {
      if (targetSocket.id.startsWith("mount-")) {
        return { valid: false, code: "building.attachment.invalid-wheel-mount", reason: "Hộp pin nặng không thể treo ở vị trí trục bánh xe!" };
      }
      if (targetSocket.id === "frame-bottom") {
        return { valid: false, code: "building.attachment.invalid-bottom", reason: "Hộp pin không thể gắn dưới gầm xe vì sẽ cạ gầm đường đua!" };
      }
      // frame-top, frame-front, frame-rear are valid
      return { valid: true };
    }
    if (targetCat === "battery") {
      return { valid: true }; // Battery chaining
    }
    return { valid: false, code: "building.attachment.invalid-target", reason: "Hộp pin chỉ có thể gắn lên nóc khung xe, cản đối trọng hoặc nối với pin khác!" };
  }

  // 5. Motor Module
  if (sourceCat === "motor") {
    if (sourceSocket.id !== "mount") {
      return { valid: false, code: "building.attachment.invalid-source-socket", reason: "Động cơ phải gắn bằng thân vỏ (mount), không thể gắn bằng trục ra!" };
    }
    if (targetCat === "frame") {
      if (targetSocket.id === "frame-bottom") {
        return { valid: false, code: "building.attachment.invalid-bottom", reason: "Động cơ không thể gắn dưới gầm xe!" };
      }
      return { valid: true };
    }
    if (targetCat === "battery") {
      return { valid: true }; // Motor coupled to battery
    }
    return { valid: false, code: "building.attachment.invalid-target", reason: "Động cơ chỉ có thể gắn lên khung xe hoặc kết hợp với hộp pin!" };
  }

  // 6. Structural Block or Heavy Beam (Frame)
  if (targetCat === "frame") {
    if (targetSocket.id.startsWith("mount-")) {
      return { valid: false, code: "building.attachment.invalid-wheel-mount", reason: "Khung xe chỉ liên kết với nhau qua các cổng khung (frame-*), không gắn vào ngàm bánh xe!" };
    }
    return { valid: true };
  }
  return { valid: false, code: "building.attachment.invalid-target", reason: "Khung dầm chỉ có thể liên kết với khung xe khác, không thể gắn lên bánh xe hay phụ tùng!" };
}
