import type { MachineBlueprint } from "../../building/domain/contracts";
import type { PhysicsDiagnosis, TelemetrySnapshot } from "./contracts";

export class PhysicsDiagnosticsEngine {
  public diagnose(snapshot: TelemetrySnapshot, blueprint: MachineBlueprint): PhysicsDiagnosis {
    const { position, rotation, elapsedSeconds, throttle, challengeId } = snapshot;
    const [, y, z] = position;

    // Check 1: Rollover / Tipped over
    if (rotation !== undefined) {
      const [qx, qy, qz, qw] = rotation;
      // Convert quaternion to pitch / roll approximations
      const sinPitch = 2 * (qw * qx - qy * qz);
      const pitch = Math.asin(Math.max(-1, Math.min(1, sinPitch)));
      const sinRoll = 2 * (qw * qz + qx * qy);
      const roll = Math.asin(Math.max(-1, Math.min(1, sinRoll)));

      if (Math.abs(roll) > Math.PI / 4 || Math.abs(pitch) > Math.PI / 3) {
        return {
          kind: "UNSTABLE_ROLLOVER",
          confidence: 0.95,
          title: "Xe Bị Lật Nghiêng",
          description: "Góc nghiêng của thân xe vượt quá giới hạn an toàn do trọng tâm cao hoặc rung xóc khi qua gờ đá.",
          detectedAtSecond: elapsedSeconds,
        };
      }
    }

    // Check 2: Level 5 High-Peak (Gờ Nhô Kẹt Bụng)
    if (challengeId === "high-peak" && elapsedSeconds > 2.5 && throttle > 0.5) {
      // The peak tip is at y = 0.58, z = 0. Stalled crawler sits around y ~ 0.9 - 1.1, z ~ 1.0 - 4.0
      if (y > 0.65 && z > -1.0 && z < 5.5) {
        return {
          kind: "HIGH_CENTERED",
          confidence: 0.98,
          title: "Xe Bị Kẹt Bụng (High-Centering)",
          description: "Khung gầm xe tì trực tiếp lên đỉnh nhọn của gờ dốc, khiến các bánh xe bị nâng bổng trên không trung và mất hoàn toàn lực bám.",
          detectedAtSecond: elapsedSeconds,
        };
      }
    }

    // Check 3: Level 4 V-Trench (Rãnh Chữ V)
    if (challengeId === "v-trench" && elapsedSeconds > 3.0 && throttle > 0.5) {
      // Climbing slope is from z ~ 1.0 to 5.0. Stalled vehicle sits around z ~ 3.5 - 4.5
      if (z >= 1.5 && z <= 5.5 && y < 0.6) {
        const hasDriveGear = blueprint.parts.some((p) => p.definitionId === "core.drive-gear");
        return {
          kind: "INSUFFICIENT_TORQUE",
          confidence: 0.9,
          title: "Thiếu Lực Kéo Thoát Dốc",
          description: hasDriveGear
            ? "Mũi xe hoặc cản trước đang cọ xát với dốc, cản trở lực kéo."
            : "Mô-men xoắn của các bánh xe không đủ lớn để thắng trọng lực khi leo dốc chữ V.",
          detectedAtSecond: elapsedSeconds,
        };
      }
    }

    // Check 4: The Gap (Hố Sâu)
    if (challengeId === "the-gap" && y < -1.5) {
      return {
        kind: "SHORT_WHEELBASE_VOID",
        confidence: 0.95,
        title: "Rơi Xuống Khe Nứt",
        description: "Chiều dài cơ sở của xe ngắn hơn khoảng cách giữa hai vách đá, khiến mũi xe chúc thẳng xuống vực sâu.",
        detectedAtSecond: elapsedSeconds,
      };
    }

    // Check 5: Level 3 Step Up (Vách Tường Đứng)
    if (challengeId === "step-up" && elapsedSeconds > 3.0 && throttle > 0.5 && z > -1.0 && z < 1.0) {
      const hasDriveGear = blueprint.parts.some((p) => p.definitionId === "core.drive-gear");
      if (!hasDriveGear) {
        return {
          kind: "KNIFE_EDGE_OVERHANG",
          confidence: 0.92,
          title: "Bị Bờ Tường Đứng Chặn Mũi",
          description: "Bánh xe cao su thông thường đâm vuông góc vào bờ tường 90° chỉ tạo phản lực ngang, không có điểm bám để nhấc bổng đầu xe lên.",
          detectedAtSecond: elapsedSeconds,
        };
      }
    }

    return {
      kind: "UNKNOWN",
      confidence: 0.1,
      title: "Đang Di Chuyển Bình Thường",
      description: "Xe đang chuyển động trong địa hình mô phỏng.",
      detectedAtSecond: elapsedSeconds,
    };
  }
}
