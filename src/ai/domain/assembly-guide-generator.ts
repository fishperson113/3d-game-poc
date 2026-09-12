import type { MachineBlueprint } from "../../building/domain/contracts";
import type { AssemblyStep, BOMItem, RealWorldCheckItem } from "./contracts";

interface PartMeta {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly category: "frame" | "steering" | "wheel" | "accessory";
}

const PART_METADATA: Record<string, PartMeta> = {
  "core.structural-block": {
    label: "Khung Xe Tiêu Chuẩn",
    icon: "🧱",
    description: "Khối thân chịu lực chính, có các lỗ chốt cắm module.",
    category: "frame",
  },
  "core.heavy-beam": {
    label: "Dầm Khung Dài",
    icon: "🏗️",
    description: "Thanh dầm dài bắc cầu vượt khe nứt rộng.",
    category: "frame",
  },
  "core.steering-hinge": {
    label: "Khớp Bẻ Lái Xoay",
    icon: "🔄",
    description: "Khớp xoay trục đứng kết nối bánh lái với khung.",
    category: "steering",
  },
  "core.powered-wheel": {
    label: "Bánh Xe Cao Su Động Cơ",
    icon: "🏎️",
    description: "Bánh xe có sẵn mô-tơ điện dẫn động quay.",
    category: "wheel",
  },
  "core.crawler-track": {
    label: "Băng Xích Xe Tăng",
    icon: "🚜",
    description: "Dải xích cao su bám đường dài tiếp xúc mặt đất.",
    category: "wheel",
  },
  "core.drive-gear": {
    label: "Bánh Răng Trợ Lực",
    icon: "⚙️",
    description: "Bánh răng cơ khí bám gờ leo dốc và tường đứng.",
    category: "accessory",
  },
  "core.battery-box": {
    label: "Hộp Pin Năng Lượng & Đối Trọng",
    icon: "🔋",
    description: "Khối pin nặng dằn trọng tâm xe chống lật.",
    category: "accessory",
  },
  "core.motor-module": {
    label: "Động Cơ Siêu Tốc",
    icon: "⚡",
    description: "Khối mô-tơ tăng tốc mô-men xoắn cao.",
    category: "accessory",
  },
};

export class AssemblyGuideGenerator {
  public generateBOM(blueprint: MachineBlueprint): readonly BOMItem[] {
    const counts = new Map<string, number>();
    for (const part of blueprint.parts) {
      counts.set(part.definitionId, (counts.get(part.definitionId) ?? 0) + 1);
    }

    const items: BOMItem[] = [];
    for (const [defId, count] of counts.entries()) {
      const meta = PART_METADATA[defId] ?? {
        label: defId,
        icon: "🧩",
        description: "Chi tiết cơ khí lắp ráp.",
        category: "accessory",
      };
      items.push({
        definitionId: defId,
        label: meta.label,
        icon: meta.icon,
        count,
        description: meta.description,
      });
    }

    // Sort: frame first, then steering, wheel, accessory
    const order = { frame: 0, steering: 1, wheel: 2, accessory: 3 };
    return items.sort((a, b) => {
      const catA = PART_METADATA[a.definitionId]?.category ?? "accessory";
      const catB = PART_METADATA[b.definitionId]?.category ?? "accessory";
      return order[catA] - order[catB];
    });
  }

  public generateAssemblySteps(blueprint: MachineBlueprint): readonly AssemblyStep[] {
    const bom = this.generateBOM(blueprint);
    const steps: AssemblyStep[] = [];

    // Step 1: Chassis Skeleton
    const frameParts = bom.filter((i) => PART_METADATA[i.definitionId]?.category === "frame");
    const frameSummary = frameParts.map((p) => `${String(p.count)}x ${p.label}`).join(", ") || "1x Khung Xe";
    steps.push({
      stepNumber: 1,
      title: "Lắp Ráp Khung Xương Xe (Chassis)",
      icon: "🏗️",
      instruction: `Lấy ${frameSummary} ra bàn học. Đặt khối khung chính nằm ngang, mặt cản trước hướng về phía trước.`,
      partsInvolved: frameParts.map((p) => p.label),
      tip: "Đảm bảo các chốt cắm socket nằm đúng hướng trái/phải đối xứng.",
    });

    // Step 2: Steering mechanism (if any)
    const steeringParts = bom.filter((i) => PART_METADATA[i.definitionId]?.category === "steering");
    if (steeringParts.length > 0) {
      steps.push({
        stepNumber: 2,
        title: "Gắn Cụm Khớp Bẻ Lái",
        icon: "🔄",
        instruction: `Gắn ${steeringParts.map((p) => `${String(p.count)}x ${p.label}`).join(", ")} vào hai chốt cắm phía trước của khung xe.`,
        partsInvolved: steeringParts.map((p) => p.label),
        tip: "Dùng tay xoay thử xem khớp lái có bẻ qua bẻ lại mượt mà không.",
      });
    }

    // Step 3: Wheels / Tracks
    const wheelParts = bom.filter((i) => PART_METADATA[i.definitionId]?.category === "wheel");
    const stepNum3 = steps.length + 1;
    steps.push({
      stepNumber: stepNum3,
      title: "Lắp Cụm Bánh Xe / Băng Xích",
      icon: "🏎️",
      instruction: `Lắp ${wheelParts.map((p) => `${String(p.count)}x ${p.label}`).join(", ")} vào các đầu trục xoay của xe.`,
      partsInvolved: wheelParts.map((p) => p.label),
      tip: "Ấn chặt tay cho đến khi nghe tiếng 'tách' để bánh không bị rơi khi xe chạy nhanh.",
    });

    // Step 4: Upgrades & Accessories
    const accessories = bom.filter((i) => PART_METADATA[i.definitionId]?.category === "accessory");
    if (accessories.length > 0) {
      const stepNum4 = steps.length + 1;
      steps.push({
        stepNumber: stepNum4,
        title: "Lắp Phụ Tùng Trợ Lực & Pin",
        icon: "⚡",
        instruction: `Gắn các chi tiết nâng cấp: ${accessories.map((p) => `${String(p.count)}x ${p.label}`).join(", ")} vào các vị trí đã thiết kế trên mô phỏng.`,
        partsInvolved: accessories.map((p) => p.label),
        tip: "Hộp pin nên đặt cân bằng ở giữa khung; Bánh răng trợ lực cần nhô ra phía trước mũi xe.",
      });
    }

    return steps;
  }

  public generateRealWorldChecklist(challengeId: string): readonly RealWorldCheckItem[] {
    const generalChecks: RealWorldCheckItem[] = [
      {
        id: "check-traction",
        question: "Bánh xe ngoài đời khi chạy trên sàn nhà có độ bám tốt hơn hay trượt hơn trong máy tính?",
        guidance: "Thử trên các bề mặt khác nhau (sàn gạch men, thảm lông, mặt bàn gỗ) để cảm nhận sự thay đổi của lực ma sát.",
        stemConcept: "Lực ma sát tiếp xúc (Friction coefficient)",
      },
      {
        id: "check-rigidity",
        question: "Các khớp nối của chiếc xe thật có bị lung lay hoặc rơ lắc khi vượt qua vật cản không?",
        guidance: "Kiểm tra độ cứng vững của các chốt cắm. Trong kỹ thuật cơ khí, rung lắc làm tiêu hao động năng của động cơ.",
        stemConcept: "Độ cứng vững kết cấu (Structural Rigidity)",
      },
    ];

    if (challengeId === "high-peak") {
      return [
        {
          id: "check-peak-clearance",
          question: "Khi em kê một chiếc thước kẻ hoặc quyển sách nhô lên làm gờ nhọn, bụng xe thật có cạ đỉnh không?",
          guidance: "Quan sát điểm tiếp xúc giữa gầm xe thật và cạnh của quyển sách. Xe 4 bánh có vượt qua êm hơn xe 8 bánh không?",
          stemConcept: "Góc vượt đỉnh (Breakover Angle)",
        },
        ...generalChecks,
      ];
    }

    if (challengeId === "v-trench") {
      return [
        {
          id: "check-climbing-torque",
          question: "Khi dốc thoát lên cao dần, bánh răng trợ lực trước mũi xe có bám chặt và kéo xe lên dốc không?",
          guidance: "Quan sát xem bánh răng ở mũi có tiếp xúc với mặt dốc trước cụm bánh xe hay không.",
          stemConcept: "Mô-men xoắn & Cánh tay đòn kéo",
        },
        ...generalChecks,
      ];
    }

    if (challengeId === "bumpy-road") {
      return [
        {
          id: "check-stability",
          question: "Khi xếp vài chiếc bút chì làm gờ đá mấp mô, chiếc xe có hộp pin nặng có chạy đầm hơn chiếc xe nhẹ không?",
          guidance: "Thử tháo hộp pin ra và chạy lại qua hàng bút chì để thấy xe nhẹ bị nảy tưng và lật nghiêng như thế nào!",
          stemConcept: "Hạ thấp trọng tâm (Center of Mass) & Quán tính",
        },
        ...generalChecks,
      ];
    }

    return generalChecks;
  }
}
