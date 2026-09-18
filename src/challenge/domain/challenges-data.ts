import type { ChallengeDefinition } from "./contracts";

export const STEM_CHALLENGES: readonly ChallengeDefinition[] = Object.freeze([
  {
    id: "warmup",
    number: 1,
    title: "Trường Tập Lái",
    subtitle: "Làm quen với buồng lái và điều khiển cơ bản",
    description: "Lắp ráp xe 4 bánh cơ bản, nhấn nút Lái Thử và đưa xe tiến về vạch đích vàng!",
    stemTip: "Dùng các phím Mũi Tên (hoặc W/A/S/D) để tăng tốc và bẻ lái. Đoạn dốc nhẹ phía trước giúp xe làm quen tốc độ!",
    icon: "🏁",
    targetTimeSeconds: 10,
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -8],
      ground: { halfExtents: [8, 0.2, 16], position: [0, -0.2, 0] },
      ramp: { halfExtents: [3, 0.15, 2], position: [0, 0.15, 0], rotation: [-0.15, 0, 0] },
      goalZone: { position: [0, 0.1, 10], size: [6, 0.2, 3] },
    },
  },
  {
    id: "the-gap",
    number: 2,
    title: "Tiếp Tế Qua Vùng Ngập",
    subtitle: "Đưa hộp vật tư đến khu cứu hộ an toàn",
    description: "Thiết kế một phương tiện đỡ được Supply Pod, vượt vùng ngập và đưa hộp hàng tới khu cứu hộ.",
    stemTip: "Quan sát Supply Pod khi xe bắt đầu chạy: hộp trượt trước hay cả chiếc xe mất cân bằng trước?",
    icon: "📦",
    targetTimeSeconds: 60,
    maxTimeSeconds: 60,
    targetHalfExtents: [0.52, 0.32, 0.52],
    failThresholdY: -0.05,
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -8],
      payload: { id: "supply-pod", definitionId: "core.supply-pod", position: [0, 3, -8], rotation: [0, 0, 0] },
      ground: { halfExtents: [6, 0.2, 4.5], position: [0, -0.2, -6.5] }, // z from -11 to -2
      obstacles: [
        // Sàn bên kia vực
        { id: "far-cliff", shape: "cuboid", halfExtents: [6, 0.2, 6], position: [0, -0.2, 6.5], friction: 1.5, color: 0x2d3748, semantic: "ground" },
        // Lan can an toàn 2 bên
        { id: "rail-left", shape: "cuboid", halfExtents: [0.2, 0.4, 4.5], position: [-6, 0.3, -6.5], friction: 0.5, color: 0x4a5568 },
        { id: "rail-right", shape: "cuboid", halfExtents: [0.2, 0.4, 4.5], position: [6, 0.3, -6.5], friction: 0.5, color: 0x4a5568 },
      ],
      goalZone: { position: [0, 0.1, 9.5], size: [5, 0.2, 3] },
    },
  },
  {
    id: "step-up",
    number: 3,
    title: "Vách Tường Đứng",
    subtitle: "Bờ tường vuông góc 90 độ chắn ngang đường",
    description: "Một bậc thềm thẳng đứng cao 0.6m chắn ngang đường đi. Hãy giúp xe bám gờ và leo lên tầng trên!",
    stemTip: "💡 Mẹo STEM: Bánh xe nhỏ va vào tường sẽ bị chặn đứng. Hãy dùng Bánh Xích Địa Hình hoặc gắn thêm Bánh Răng nhô cao ở mũi xe để bám vào gờ tường!",
    icon: "🧗",
    targetTimeSeconds: 15,
    unlockReward: "Bánh Răng Trợ Lực ⚙️ & Động Cơ Siêu Tốc ⚡",
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -8],
      ground: { halfExtents: [6, 0.2, 6.5], position: [0, -0.2, -5.5] }, // z: -12 to 1
      obstacles: [
        // Bờ tường đứng 90 độ
        { id: "wall-step", shape: "cuboid", halfExtents: [6, 0.3, 0.25], position: [0, 0.3, 1.25], friction: 2.0, color: 0xb45309 },
        // Sàn tầng trên
        { id: "upper-deck", shape: "cuboid", halfExtents: [6, 0.2, 5.5], position: [0, 0.4, 6.8], friction: 1.5, color: 0x1f2937, semantic: "ground" },
      ],
      goalZone: { position: [0, 0.7, 9.5], size: [5, 0.2, 3] },
    },
  },
  {
    id: "v-trench",
    number: 4,
    title: "Rãnh Chữ V Hiểm Trở",
    subtitle: "Dốc chúi sâu gặp dốc ngược dốc đứng",
    description: "Rãnh dốc hình chữ V thử thách góc tới và góc thoát của xe. Cẩn thận kẻo cạ mũi xe và kẹt cứng!",
    stemTip: "💡 Mẹo STEM: Nâng cao khoảng sáng gầm xe và thu gọn cản trước/sau để đầu và đuôi xe không bị quẹt xuống dốc!",
    icon: "⚡",
    targetTimeSeconds: 15,
    failThresholdY: -4.5,
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -10],
      ground: { halfExtents: [6, 0.2, 5], position: [0, -0.2, -10] },
      obstacles: [
        // Dốc xuống hình chữ V (khớp mượt mà không có khe hở hay gờ khấc)
        { id: "down-slope", shape: "cuboid", halfExtents: [5.5, 0.10, 2.022], position: [0, -0.399, -3.015], rotation: [-0.14889, 0, 0], friction: 2.2, color: 0x475569 },
        // Đáy rãnh
        { id: "bottom-pad", shape: "cuboid", halfExtents: [5.5, 0.10, 1.0], position: [0, -0.70, 0], friction: 2.2, color: 0x334155 },
        // Dốc lên hình chữ V
        { id: "up-slope", shape: "cuboid", halfExtents: [5.5, 0.10, 2.022], position: [0, -0.399, 3.015], rotation: [0.14889, 0, 0], friction: 2.2, color: 0x475569 },
        // Sàn đích
        { id: "exit-deck", shape: "cuboid", halfExtents: [6, 0.2, 5], position: [0, -0.2, 10], friction: 1.8, color: 0x1e293b, semantic: "ground" },
        // Lan can an toàn 2 bên
        { id: "rail-left", shape: "cuboid", halfExtents: [0.2, 0.5, 9.5], position: [-5.6, 0.3, 0], friction: 0.2, color: 0x64748b },
        { id: "rail-right", shape: "cuboid", halfExtents: [0.2, 0.5, 9.5], position: [5.6, 0.3, 0], friction: 0.2, color: 0x64748b },
        // Gờ chặn cuối đường
        { id: "end-wall", shape: "cuboid", halfExtents: [6, 0.5, 0.3], position: [0, 0.5, 14.5], friction: 0.5, color: 0x3b82f6 },
      ],
      goalZone: { position: [0, 0.1, 10.5], size: [5, 0.2, 3] },
    },
  },
  {
    id: "high-peak",
    number: 5,
    title: "Gờ Nhô Kẹt Bụng",
    subtitle: "Gờ dốc nhọn làm hổng bánh xe trên không",
    description: "Một gờ dốc nhọn chắn ngang đường. Nếu xe có gầm thấp hoặc trục quá dài mà không có bánh giữa nâng đỡ, xe sẽ bị kẹt bụng!",
    stemTip: "💡 Mẹo STEM: Tăng đường kính bánh xe, hoặc lắp thêm cụm bánh giữa / bánh xích dài để bụng xe không chạm đỉnh chóp!",
    icon: "⛰️",
    targetTimeSeconds: 15,
    unlockReward: "Hộp Pin Năng Lượng & Cân Bằng Trọng Tâm 🔋",
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -8],
      ground: { halfExtents: [7, 0.2, 14], position: [0, -0.2, 0] },
      obstacles: [
        // Gờ nhô dốc lên
        { id: "peak-front", shape: "cuboid", halfExtents: [5, 0.15, 1.4], position: [0, 0.25, -0.8], rotation: [-0.32, 0, 0], friction: 1.8, color: 0xd97706 },
        // Gờ nhô dốc xuống
        { id: "peak-back", shape: "cuboid", halfExtents: [5, 0.15, 1.4], position: [0, 0.25, 0.8], rotation: [0.32, 0, 0], friction: 1.8, color: 0xd97706 },
        // Gờ đỉnh nhọn
        { id: "peak-tip", shape: "cuboid", halfExtents: [5, 0.1, 0.2], position: [0, 0.58, 0], friction: 1.8, color: 0xb45309 },
        // Gờ chặn cuối đường
        { id: "end-wall", shape: "cuboid", halfExtents: [7, 0.5, 0.3], position: [0, 0.5, 13.5], friction: 0.5, color: 0x3b82f6 },
      ],
      goalZone: { position: [0, 0.1, 9.5], size: [5, 0.2, 3] },
    },
  },
  {
    id: "bumpy-road",
    number: 6,
    title: "Bãi Đá Gập Ghềnh",
    subtitle: "Chuỗi chướng ngại vật mấp mô liên tiếp",
    description: "Các gờ đá nhấp nhô liên tục khiến xe lắc lư dữ dội. Liệu xe của bạn có giữ được thăng bằng để về đích an toàn?",
    stemTip: "💡 Mẹo STEM: Đặt Hộp Pin nặng ở giữa để hạ thấp trọng tâm, giúp xe vững như bàn thạch khi chạy qua các gờ nhấp nhô!",
    icon: "🪨",
    targetTimeSeconds: 20,
    environment: {
      gravity: [0, -9.81, 0],
      spawn: [0, 0.75, -10],
      ground: { halfExtents: [7, 0.2, 15], position: [0, -0.2, 0] },
      obstacles: [
        // Các gờ đá mấp mô hình trụ so le (asymmetric staggered cylinders) nhấp nhô nhưng bo tròn không gây kẹt góc vuông
        { id: "bump-1", shape: "cylinder", radius: 0.20, halfHeight: 2.5, position: [-2.2, 0.05, -5], rotation: [0, 0, 1.5707963267948966], friction: 1.8, color: 0x78716c },
        { id: "bump-2", shape: "cylinder", radius: 0.22, halfHeight: 2.5, position: [2.2, 0.05, -2.5], rotation: [0, 0, 1.5707963267948966], friction: 1.8, color: 0x78716c },
        { id: "bump-3", shape: "cylinder", radius: 0.24, halfHeight: 2.8, position: [-1.5, 0.05, 0], rotation: [0, 0, 1.5707963267948966], friction: 1.8, color: 0x78716c },
        { id: "bump-4", shape: "cylinder", radius: 0.22, halfHeight: 2.5, position: [2.2, 0.05, 2.5], rotation: [0, 0, 1.5707963267948966], friction: 1.8, color: 0x78716c },
        { id: "bump-5", shape: "cylinder", radius: 0.20, halfHeight: 2.5, position: [-2.0, 0.05, 5], rotation: [0, 0, 1.5707963267948966], friction: 1.8, color: 0x78716c },
        // Lan can an toàn 2 bên
        { id: "rail-left", shape: "cuboid", halfExtents: [0.2, 0.5, 15], position: [-6.8, 0.3, 0], friction: 0.2, color: 0x64748b },
        { id: "rail-right", shape: "cuboid", halfExtents: [0.2, 0.5, 15], position: [6.8, 0.3, 0], friction: 0.2, color: 0x64748b },
        // Gờ chặn cuối đường
        { id: "end-wall", shape: "cuboid", halfExtents: [7, 0.5, 0.3], position: [0, 0.5, 14.5], friction: 0.5, color: 0x3b82f6 },
      ],
      goalZone: { position: [0, 0.1, 10.5], size: [10, 0.2, 3] },
    },
  },
]);
