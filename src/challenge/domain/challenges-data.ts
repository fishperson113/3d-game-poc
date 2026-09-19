import type { ChallengeDefinition } from "./contracts";

export const STEM_CHALLENGES: readonly ChallengeDefinition[] = Object.freeze([
  {
    id: "warmup",
    number: 1,
    title: "Đánh Thức Trạm Thời Tiết",
    subtitle: "Đưa xe thăm dò đến cột tín hiệu đầu tiên",
    description: "Trạm thời tiết vừa mất kết nối. Một xe thăm dò cần tới cột tín hiệu để khởi động lại đường truyền.",
    stemTip: "Khi con bấm tiến hoặc rẽ, bộ phận nào của xe chuyển động trước?",
    mission: {
      kicker: "NHIỆM VỤ KHỞI ĐỘNG",
      context: "Sau cơn mưa, trạm thời tiết không còn gửi dữ liệu về trung tâm.",
      objective: "Lắp một xe thăm dò và đưa xe từ Gara đến Cột tín hiệu.",
      route: ["🔧 Gara", "📡 Cột tín hiệu"],
      rules: ["🎮 Chỉ điều khiển xe sau khi bấm Chơi.", "🛞 Xe cần tự di chuyển đến đích.", "🏁 Dừng trong vùng sáng màu xanh."],
      success: "Xe đi vào vùng tín hiệu và trạm kết nối trở lại.",
    },
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
    mission: {
      kicker: "NHIỆM VỤ CỨU HỘ",
      context: "Sau trận mưa lớn, người dân phía bên kia vùng ngập đang cần bộ lọc nước.",
      objective: "Đưa Supply Pod 100g từ Trạm xuất phát đến Khu cứu hộ.",
      route: ["🏕️ Trạm xuất phát", "🏥 Khu cứu hộ"],
      rules: ["📦 Đỡ và giữ Supply Pod trên xe.", "🌊 Không để hộp chạm vùng ngập.", "⏱️ Hoàn thành trong 60 giây."],
      success: "Toàn bộ Supply Pod nằm trong Khu cứu hộ.",
    },
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
    title: "Khởi Động Trạm Phát Sóng",
    subtitle: "Đưa xe kỹ thuật lên sàn trạm ở trên cao",
    description: "Trạm phát sóng trên sân cao đã tắt. Xe kỹ thuật phải vượt bậc tường để bật nguồn dự phòng.",
    stemTip: "Khi xe dừng trước bậc, phần nào chạm vào vách trước và phần nào vẫn còn quay?",
    mission: {
      kicker: "NHIỆM VỤ TRÊN CAO",
      context: "Một trạm phát sóng nằm trên sân cao đã mất điện sau giông.",
      objective: "Đưa xe kỹ thuật vượt bậc tường và tới Bảng nguồn.",
      route: ["🛠️ Chân trạm", "📻 Bảng nguồn"],
      rules: ["🧗 Xe phải tự vượt bậc đứng.", "🧩 Chỉ dùng phụ tùng trong xưởng.", "🏁 Toàn bộ xe cần lên được sàn trên."],
      success: "Xe vào vùng đích trên sàn và trạm phát sóng hoạt động lại.",
    },
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
    title: "Khảo Sát Mương Thoát Nước",
    subtitle: "Đi xuống đáy mương rồi trở lên an toàn",
    description: "Đội sửa chữa cần biết đáy mương có bị tắc sau mưa. Xe khảo sát phải đi xuống và thoát lên bờ bên kia.",
    stemTip: "Khi xe mắc lại, mũi, bụng hay đuôi xe đang chạm mặt dốc?",
    mission: {
      kicker: "NHIỆM VỤ KHẢO SÁT",
      context: "Nước mưa rút chậm và đội sửa chữa cần kiểm tra đáy mương chữ V.",
      objective: "Đưa xe khảo sát qua đáy mương và lên Điểm thu dữ liệu.",
      route: ["🔎 Bờ kiểm tra", "💾 Điểm thu dữ liệu"],
      rules: ["↘️ Xe phải đi qua đáy mương.", "🚫 Không để xe rơi khỏi đường khảo sát.", "🏁 Tự leo lên bờ bên kia để hoàn thành."],
      success: "Xe ra khỏi mương và truyền được dữ liệu ở vùng đích.",
    },
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
    title: "Kiểm Tra Sống Đê",
    subtitle: "Vượt đỉnh đê nhọn mà không mắc lại",
    description: "Một đoạn sống đê mới đắp cần được kiểm tra. Xe đo đạc phải vượt qua đỉnh nhọn để tới mốc quan trắc.",
    stemTip: "Nếu bánh vẫn quay mà xe không tiến, điểm nào dưới xe đang tì lên đỉnh đê?",
    mission: {
      kicker: "NHIỆM VỤ ĐO ĐẠC",
      context: "Đội phòng chống lũ cần kiểm tra hai phía của một đoạn sống đê mới.",
      objective: "Đưa xe đo đạc qua đỉnh đê đến Mốc quan trắc.",
      route: ["📐 Trạm đo A", "🚩 Mốc quan trắc"],
      rules: ["⛰️ Xe phải vượt qua đúng đỉnh đê.", "⚙️ Xe không được mắc bụng trên đỉnh.", "🏁 Tới vùng đích bằng chính hệ truyền động."],
      success: "Xe vượt hẳn sống đê và vào vùng mốc quan trắc.",
    },
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
    title: "Mở Đường Qua Bãi Đá",
    subtitle: "Tìm một lối ổn định cho đội cứu hộ",
    description: "Đá nhỏ tràn xuống đường sau mưa. Xe dẫn đường phải băng qua bãi đá để đánh dấu tuyến đi an toàn.",
    stemTip: "Khi xe lắc mạnh, phần nào nghiêng trước và bánh nào rời mặt đường?",
    mission: {
      kicker: "NHIỆM VỤ DẪN ĐƯỜNG",
      context: "Một đội cứu hộ đang chờ bản đồ đường đi qua khu vực vừa sạt đá.",
      objective: "Đưa xe dẫn đường qua năm gờ đá và tới Cọc đánh dấu.",
      route: ["🗺️ Điểm khảo sát", "🚩 Cọc đánh dấu"],
      rules: ["🪨 Đi qua chuỗi gờ đá trên tuyến.", "⚖️ Giữ xe không lật khỏi đường.", "🏁 Tới vùng đích để lưu tuyến an toàn."],
      success: "Xe tới Cọc đánh dấu và hoàn tất bản đồ tuyến đường.",
    },
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
