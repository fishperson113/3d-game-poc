import type { HintTier, PhysicsDiagnosisKind, SocraticHint } from "./contracts";

export class SocraticTutorEngine {
  public getHints(challengeId: string, diagnosisKind: PhysicsDiagnosisKind): readonly SocraticHint[] {
    // Challenge 5: High-Peak
    if (challengeId === "high-peak" || diagnosisKind === "HIGH_CENTERED") {
      return [
        {
          tier: 1,
          tierLabel: "Tầng 1 · Nhắc Mục Tiêu",
          category: "reminder",
          title: "Vượt Qua Gờ Đỉnh Nhọn",
          content: "Thử thách yêu cầu xe vượt qua gờ dốc nhọn có đỉnh cao mà không bị kẹt lại hay treo lơ lửng.",
        },
        {
          tier: 2,
          tierLabel: "Tầng 2 · Câu Hỏi Gợi Mở (Socratic)",
          category: "socratic_question",
          title: "Quan Sát Bánh Xe & Bụng Xe",
          content: "Ồ! Bánh xe vẫn quay tít nhưng tại sao xe không tiến tới được nhỉ? Em hãy nhìn kỹ xem phần bụng xe đang chạm vào đâu và các bánh xe có chạm đất không?",
        },
        {
          tier: 3,
          tierLabel: "Tầng 3 · Khoanh Vùng Vấn Đề",
          category: "focus_area",
          title: "Khoảng Cách Giữa Hai Trục Bánh Xe",
          content: "Hãy chú ý khoảng cách giữa trục bánh xe trước và trục bánh xe sau so với chiều rộng của đỉnh chóp nhọn trên đường đua!",
        },
        {
          tier: 4,
          tierLabel: "Tầng 4 · Nguyên Lý STEM",
          category: "stem_principle",
          title: "Góc Vượt Đỉnh (Breakover Angle)",
          content: "Trong kỹ thuật ô tô, Góc Vượt Đỉnh quyết định khả năng vượt gờ của xe. Chiếc xe có trục cơ sở càng dài thì góc vượt đỉnh càng nhỏ, đỉnh dốc sẽ tì thẳng vào bụng xe làm toàn bộ bánh xe bị nâng bổng trên không (High-Centering).",
          stemPrinciple: "Góc Vượt Đỉnh = Khả năng vượt qua chóp nhọn mà gầm xe không cạ đất.",
        },
        {
          tier: 5,
          tierLabel: "Tầng 5 · Chỉ Dẫn Hành Động",
          category: "actionable_step",
          title: "Đổi Sang Xe Trục Cơ Sở Ngắn",
          content: "Hãy thử đổi sang chiếc Xe Trinh Sát 4 bánh (four-wheel-scout) có trục cơ sở ngắn. Bánh trước sẽ chạm sàn dốc đối diện trước khi bụng xe kịp chạm vào đỉnh nhọn!",
          actionPrompt: "Chọn Xe Mẫu: 'Scout Buggy (4 bánh)' và lái thử lại.",
        },
      ];
    }

    // Challenge 4: V-Trench
    if (challengeId === "v-trench" || diagnosisKind === "INSUFFICIENT_TORQUE") {
      return [
        {
          tier: 1,
          tierLabel: "Tầng 1 · Nhắc Mục Tiêu",
          category: "reminder",
          title: "Thoát Khỏi Rãnh Chữ V",
          content: "Xe cần lao xuống dốc rãnh và leo ngược lên dốc đối diện để đến vạch đích.",
        },
        {
          tier: 2,
          tierLabel: "Tầng 2 · Câu Hỏi Gợi Mở (Socratic)",
          category: "socratic_question",
          title: "Thiếu Tốc Độ Hay Lực Kéo?",
          content: "Xe đang chạy chậm dần rồi dừng lại ở lưng chừng dốc. Theo em, xe đang thiếu tốc độ hay thiếu lực kéo (mô-men xoắn) khi leo dốc?",
        },
        {
          tier: 3,
          tierLabel: "Tầng 3 · Khoanh Vùng Vấn Đề",
          category: "focus_area",
          title: "Cản Trước & Lực Kéo Bánh Xe",
          content: "Hãy quan sát phần mũi xe phía trước (frame-front) và lực kéo mà động cơ truyền vào mặt dốc thoát rãnh.",
        },
        {
          tier: 4,
          tierLabel: "Tầng 4 · Nguyên Lý STEM",
          category: "stem_principle",
          title: "Mô-Men Xoắn & Bánh Tỳ Leo Dốc",
          content: "Mô-men xoắn (Torque) là lực xoay giúp xe thắng được thành phần trọng lực kéo lùi khi leo dốc. Khi gắn thêm bánh răng trợ lực nhô ra phía trước, nó vừa tăng thêm 75 Nm lực kéo vừa đóng vai trò bánh tỳ nâng đầu xe lên mặt dốc.",
          stemPrinciple: "Mô-men xoắn càng lớn thì khả năng leo dốc càng cao.",
        },
        {
          tier: 5,
          tierLabel: "Tầng 5 · Chỉ Dẫn Hành Động",
          category: "actionable_step",
          title: "Gắn Bánh Răng Trợ Lực Ở Mũi Xe",
          content: "Vào menu phụ tùng, chọn 'Bánh Răng Trợ Lực' và gắn vào chốt cản trước (frame-front) của xe!",
          actionPrompt: "Gắn 'Bánh Răng Trợ Lực ⚙️' vào cản trước.",
        },
      ];
    }

    // Challenge 6: Bumpy-Road / Rollover
    if (challengeId === "bumpy-road" || diagnosisKind === "UNSTABLE_ROLLOVER") {
      return [
        {
          tier: 1,
          tierLabel: "Tầng 1 · Nhắc Mục Tiêu",
          category: "reminder",
          title: "Vượt Bãi Đá An Toàn",
          content: "Giữ xe thăng bằng vững chắc và vượt qua chuỗi gờ đá nhấp nhô liên tiếp.",
        },
        {
          tier: 2,
          tierLabel: "Tầng 2 · Câu Hỏi Gợi Mở (Socratic)",
          category: "socratic_question",
          title: "Tại Sao Xe Lại Nảy Chồm?",
          content: "Khi lăn qua các tảng đá nhấp nhô, tại sao chiếc xe lại bị rung xóc dữ dội và chao đảo dễ lật? Làm sao để xe đầm chắc hơn?",
        },
        {
          tier: 3,
          tierLabel: "Tầng 3 · Khoanh Vùng Vấn Đề",
          category: "focus_area",
          title: "Khối Lượng & Trọng Tâm Xe",
          content: "Quan sát vị trí trọng tâm của xe. Thân xe hiện tại nhẹ hay nặng, và trọng tâm nằm ở trên cao hay dưới thấp?",
        },
        {
          tier: 4,
          tierLabel: "Tầng 4 · Nguyên Lý STEM",
          category: "stem_principle",
          title: "Trọng Tâm (Center of Mass) & Cân Bằng",
          content: "Một chiếc xe có trọng tâm thấp và phân bổ đều giữa các bánh xe sẽ có độ ổn định tĩnh rất cao. Khối lượng nặng dằn các bánh xe ép chặt xuống đất, triệt tiêu phản lực nảy ngược từ gờ đá.",
          stemPrinciple: "Hạ thấp trọng tâm giúp xe chống lật khi gặp địa hình mấp mô.",
        },
        {
          tier: 5,
          tierLabel: "Tầng 5 · Chỉ Dẫn Hành Động",
          category: "actionable_step",
          title: "Gắn Hộp Pin Đối Trọng Lên Khung",
          content: "Chọn 'Hộp Pin Trọng Tâm' (khối lượng 6kg) và gắn lên mặt trên của khung xe (frame-top) để xe chạy đầm chắc như bàn thạch!",
          actionPrompt: "Gắn 'Hộp Pin Trọng Tâm 🔋' vào khung xe.",
        },
      ];
    }

    // Default fallback hints
    return [
      {
        tier: 1,
        tierLabel: "Tầng 1 · Nhắc Mục Tiêu",
        category: "reminder",
        title: "Khám Phá Địa Hình",
        content: "Quan sát kỹ địa hình phía trước và điều khiển xe lái thử từ từ qua chướng ngại vật.",
      },
      {
        tier: 2,
        tierLabel: "Tầng 2 · Câu Hỏi Gợi Mở (Socratic)",
        category: "socratic_question",
        title: "Điều Gì Cản Trở Chiếc Xe?",
        content: "Chướng ngại vật nào đang làm xe gặp khó khăn nhất? Bánh xe của em có đủ độ bám đường không?",
      },
      {
        tier: 3,
        tierLabel: "Tầng 3 · Khoanh Vùng Vấn Đề",
        category: "focus_area",
        title: "Kiểm Tra Cấu Trúc Khung Xe",
        content: "Hãy kiểm tra các liên kết giữa khung xe và bánh xe xem đã cân đối và chắc chắn chưa.",
      },
      {
        tier: 4,
        tierLabel: "Tầng 4 · Nguyên Lý STEM",
        category: "stem_principle",
        title: "Thiết Kế Cơ Khí Có Chủ Đích",
        content: "Mỗi loại địa hình cần một cấu hình xe phù hợp: đường nứt cần xe dài, dốc cao cần bánh răng trợ lực, bãi đá cần trọng tâm thấp.",
      },
      {
        tier: 5,
        tierLabel: "Tầng 5 · Chỉ Dẫn Hành Động",
        category: "actionable_step",
        title: "Thử Nghiệm & Cải Tiến Xe",
        content: "Nhấn '🛑 Về Xưởng' để thêm hoặc thay đổi linh kiện, sau đó bấm '🎮 Lái Thử' để kiểm chứng lại giả thuyết nhé!",
      },
    ];
  }

  public getHintAtTier(hints: readonly SocraticHint[], tier: HintTier): SocraticHint {
    const found = hints.find((h) => h.tier === tier);
    if (found !== undefined) return found;
    const first = hints[0];
    if (first !== undefined) return first;
    return {
      tier: 1,
      tierLabel: "Tầng 1 · Nhắc Nhở",
      category: "reminder",
      title: "Tiếp Tục Quan Sát",
      content: "Hãy tiếp tục quan sát hành vi của xe khi di chuyển.",
    };
  }
}
