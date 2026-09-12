# TÀI LIỆU CHUYỂN GIAO TIẾN TRÌNH & NGỮ CẢNH DỰ ÁN (PROJECT CHAT HANDOVER)
> **Mục đích**: File này lưu lại toàn bộ tiến trình trao đổi, các quyết định kiến trúc, các lỗi đã phát hiện & khắc phục, kết quả kiểm thử và trạng thái hiện tại của dự án `stem-simulator-ai`. Bạn có thể gửi file này vào một phiên chat mới để tiếp tục phát triển mà không bị mất ngữ cảnh.
> **Thời điểm cập nhật**: 2026-09-12

---

## 1. TỔNG QUAN DỰ ÁN & CÁC YÊU CẦU ĐÃ THỰC HIỆN

Dự án là một ứng dụng Web PoC mô phỏng xe địa hình vật lý 3D phục vụ giáo dục STEM cho học sinh cấp 1 đến cấp 2, sử dụng Three.js (render) và Rapier 3D (WASM physics engine), phát triển bằng TypeScript thuần và Vanilla CSS (không Tailwind).

### 3 Nhiệm vụ trọng tâm ban đầu:
1. **Mô phỏng 6 Thử Thách STEM Vượt Địa Hình**:
   - Dựa trên `challenges.md` và `docs/03-content-and-challenge.md`.
   - Mỗi màn có địa hình vật lý riêng biệt, chướng ngại vật 3D, vạch xuất phát, cổng đích phát sáng, mục tiêu thời gian và đánh giá 1-3 sao ⭐.
2. **Bổ sung 5 Linh Kiện / Module Xe Mới**:
   - `core.heavy-beam`: Dầm khung dài kéo dài trục cơ sở.
   - `core.battery-box`: Hộp pin đối trọng nặng ($6.0\text{kg}$) giúp hạ thấp trọng tâm.
   - `core.crawler-track`: Băng xích xe tăng độ bám cao ($\mu = 2.6$).
   - `core.motor-module`: Động cơ siêu tốc mô-men xoắn lớn.
   - `core.drive-gear`: Bánh răng trợ lực leo tường/leo dốc ($75\text{ Nm}$).
3. **Tái thiết kế toàn diện UI/UX Gamification cho Học Sinh**:
   - Giao diện tiếng Việt 100%, Mascot Robot Rô-Bô 🤖 đồng hành.
   - Bản đồ chọn màn chơi 6 cấp độ với huy hiệu sao ⭐.
   - Thanh công cụ, menu linh kiện thẻ to trực quan, màu sắc phân biệt rõ ràng.
   - Touch D-Pad ảo 4 hướng trên màn hình + Hỗ trợ bàn phím WASD / Mũi tên (nhận diện cả bộ gõ Telex tiếng Việt: `w`, `ư`, `s`, `a`, `d`, `đ`).
   - Hiệu ứng âm thanh sinh động (Web Audio API thuần không phụ thuộc file ngoài).

---

## 2. QUÁ TRÌNH PHẢN HỒI TỪ NGƯỜI DÙNG & CÁC FIX CỐT LÕI

Trong suốt phiên làm việc, người dùng đã đưa ra các phản hồi và kiểm thử thực tế, tất cả đã được phân tích và sửa triệt để:

### Feedback 1: Chức năng tháo module không thật sự tháo, làm xe bị đứng im khi bấm Lái Thử
- **Nguyên nhân**: Khi gỡ khớp nối cũ, linh kiện vẫn tồn tại trong danh sách `blueprint.parts`. Trình biên dịch Rapier kiểm tra tính liên thông `graphIsConnected` phát hiện module bị cô lập mồ côi nên báo lỗi `simulation.compile.disconnected-machine`.
- **Đã sửa**: Viết hàm `pruneDisconnectedParts()` tự động dọn sạch các module mất liên kết khỏi xe. Thêm nút đỏ `🗑️ Tháo Module Khỏi Xe` trong Inspector và tự động dọn rác trước khi chạy mô phỏng.

### Feedback 2: Xe quẹo trái/phải bị ngược hướng
- **Nguyên nhân**: Góc camera ban đầu quay từ phía trước nhìn lại (xe chạy đối diện người chơi). Do nhìn ngược, khi xe rẽ trái của xe thì trên màn hình lại quẹo sang phải.
- **Đã sửa**: Đặt góc camera mặc định thành **Chase Camera chuẩn (nhìn từ sau đuôi xe dọc theo hướng mũi xe)** (`theta = 2.79, phi = 0.52, radius = 10m`). Bổ sung nút bấm `🎥 Góc Nhìn Chuẩn` trên thanh công cụ.

### Feedback 3: Cần 1 mốc Start ở mỗi challenge và đặt xe ở đó khi về xưởng
- **Đã sửa**: Thiết kế vạch xuất phát hình đĩa phát sáng xanh lục (Start Pad) tại vị trí spawn của từng màn chơi. Cả khi ở xưởng chế tạo hay khi bấm "Về Xưởng", xe luôn được căn chuẩn ngay tại vạch xuất phát.

### Feedback 4: Lỗi `building.part.duplicate.id` khi thêm bánh răng vào motor
- **Nguyên nhân**: Trùng ID linh kiện do bộ sinh ID dùng chung prefix hoặc index không unique.
- **Đã sửa**: Chuẩn hóa thuật toán sinh ID duy nhất trong `MachineBuildingService` và `assembly-solver.ts`.

### Feedback 5: Xe không nhận phím WASD hoặc không có nút điều khiển
- **Đã sửa**:
  - Viết lại `KeyboardInputSource` với hàm `normalizeControlKey`: hỗ trợ đồng thời cả phím WASD thường, viết hoa, phím mũi tên và bộ gõ tiếng Việt (Unikey/EVKey gõ `ư` cho `w`, `đ` cho `d`).
  - Xây dựng cụm D-Pad 4 nút cảm ứng trên giao diện lái thử với hiệu ứng active trực quan.

### Feedback 6: Màn 3 (Vách Tường Đứng) gắn bánh răng nhưng không leo qua được
- **Nguyên nhân**: Đã chạy thử mô phỏng vật lý 3D Rapier và phát hiện:
  - Bánh răng cũ chỉ có mô-men xoắn $38\text{ Nm}$, bán kính $0.44\text{m}$, quá yếu để nâng bổng đầu xe $15\text{kg}$.
  - Socket solver không ưu tiên cản trước mà có thể gắn bánh răng ra sau đuôi hoặc bên hông.
- **Đã sửa**:
  - Nâng cấp `core.drive-gear`: Mô-men xoắn tăng lên **$75\text{ Nm}$**, hệ số ma sát bám gờ tăng lên **$2.5$**, bán kính mở rộng lên **$0.48\text{m}$**.
  - Thiết lập ưu tiên đặc biệt (`priority = -1`) cho `core.drive-gear` tại socket `frame-front` (cản trước).
  - Kết quả: Xe gắn bánh răng leo bờ tường đứng $0.6\text{m}$ thành công 100% trong mô phỏng!

### Feedback 7: Chạy thử nghiệm, sửa lỗi và tìm giải pháp cho các Màn 4, 5, 6
- **Chi tiết xem ở Phần 3 bên dưới**.

---

## 3. PHÂN TÍCH VẬT LÝ, BUGS & GIẢI PHÁP CHO MÀN 4, 5, 6

### Màn 4: Rãnh Chữ V (V-Trench)
- **Bugs đã phát hiện & sửa**:
  1. *Lỗi Evaluator thất bại oan*: `challenge-evaluator.ts` fix cứng ngưỡng rơi vực $Y < -2.2\text{m}$. Trong khi rãnh chữ V hạ thấp $Y \approx -0.7\text{m}$, xe nhún mạnh dễ bị xử thua. Đã sửa thành `this.challenge.failThresholdY ?? -2.2` và đặt `failThresholdY: -4.5` ở Màn 4.
  2. *Sàn xuất phát ngắn*: Kéo dài sàn xuất phát lên `halfExtents: [6, 0.2, 5], position: [0, -0.2, -10]` để xe 8 bánh không bị thò đuôi ra ngoài khoảng trống.
  3. *Hình học tiếp giáp*: Thiết kế dốc $\theta = 8.5^\circ$ kết hợp sàn đệm đáy rãnh chuyển tiếp liên tục không có gờ khấc hay khe hở.
  4. *Motor damping Rapier*: Sửa damping trong `rapier-physics-world.ts` thành `const driveDamping = Math.max(25, actuator.maxForce * 0.5)` để động cơ đạt đủ mô-men xoắn định mức.
- **Giải pháp STEM**:
  - Xe nguyên bản (`four-wheel-scout` $32\text{ Nm}$): Kẹt lại giữa dốc thoát ($Z = 3.78\text{m}$).
  - Gắn **Bánh Răng Trợ Lực (`core.drive-gear`)** vào cản trước (`frame-front`): Cung cấp $75\text{ Nm}$, đóng vai trò bánh tỳ kéo xe vượt dốc thoát về đích an toàn trong **$6.95\text{s}$**!

### Màn 5: Gờ Nhô Kẹt Bụng (High-Peak)
- **Bugs đã phát hiện & sửa**: Bổ sung gờ chắn an toàn `end-wall` tại $Z = 13.5\text{m}$ chống trôi xe sau khi thắng.
- **Nguyên lý STEM Breakover Angle (Góc Vượt Đỉnh)**:
  - Xe trục cơ sở dài (`eight-wheel-crawler` $7.5\text{m}$): Khi trèo lên đỉnh gờ, bụng chassis nằm đè lên chóp nhọn, 8 bánh xe bị nhấc bổng lơ lửng trong không trung ($Y = 1.06\text{m}, Z = 2.27\text{m}$). Bánh quay tít mà xe đứng im (High-Centered).
  - Giải pháp STEM: Dùng xe trục cơ sở ngắn như **Xe Trinh Sát 4 bánh (`four-wheel-scout`)**. Bánh trước chạm sàn dốc bên kia trước khi đáy khung cạ đỉnh, vượt qua đỉnh nhọn dễ dàng và về đích!

### Màn 6: Bãi Đá Gập Ghềnh (Bumpy-Road)
- **Bugs đã phát hiện & sửa**:
  1. *Chướng ngại vật hộp vuông*: Thay thế toàn bộ khối hộp góc vuông $90^\circ$ (gây khựng bánh như tường gạch) bằng các khối trụ tròn (`shape: "cylinder"`, bán kính $0.20 - 0.24\text{m}$) nằm ngang trục X. Bánh xe lăn trèo nhún xóc tự nhiên.
  2. *Thiếu socket trên nóc xe*: Bổ sung socket `frame-top` (`[0, 0.25, 0]`) và `frame-bottom` vào `structural-block/manifest.json`.
  3. *Mở rộng vạch đích*: Thêm lan can 2 bên và mở rộng `goalZone` có bề rộng $10\text{m}$ bao trọn mặt đường.
- **Giải pháp STEM (Hạ Thấp Trọng Tâm)**:
  - Gắn **Hộp Pin Năng Lượng & Đối Trọng (`core.battery-box`)** lên mặt trên chassis (`frame-top`).
  - Khối lượng $6.0\text{kg}$ đặt ngay trọng tâm dằn chặt các bánh xe xuống mặt đường, triệt tiêu quán tính lắc ngang, xe chạy đầm chắc vượt qua toàn bộ chuỗi gờ đá và về đích trong **$7.43\text{s}$**!

---

## 4. DANH SÁCH FILE ĐÃ THAY ĐỔI & FILE KIỂM THỬ QUAN TRỌNG

### Mã nguồn chính:
- `src/challenge/domain/contracts.ts`: Thêm `failThresholdY?: number` cho `ChallengeDefinition`.
- `src/challenge/domain/challenge-evaluator.ts`: Sử dụng `failThresholdY` thay vì giá trị hardcode $-2.2\text{m}$.
- `src/challenge/domain/challenges-data.ts`: Cấu hình chi tiết 6 màn chơi, kích thước sàn xuất phát, dốc chữ V liên tục, gờ nhọn đỉnh, khối đá trụ tròn Màn 6.
- `src/parts/structural-block/manifest.json`: Bổ sung socket `frame-top` và `frame-bottom`.
- `src/parts/drive-gear/manifest.json`: Nâng cấp lực kéo lên $75\text{ Nm}$, ma sát $2.5$, bán kính $0.48\text{m}$.
- `src/parts/crawler-track/manifest.json`: Chuẩn hóa collider dạng cylinder bán kính $0.50\text{m}$, mô-men xoắn $75\text{ Nm}$.
- `src/adapters/rapier/rapier-physics-world.ts`: Mở khóa motor damping theo `actuator.maxForce`, sửa logic vi sai skid steering cho bánh xe/băng xích.
- `src/building/application/assembly-solver.ts`: Ưu tiên cản trước `frame-front` cho bánh răng trợ lực (`priority = -1`).
- `src/adapters/input/keyboard-input-source.ts`: Nhận diện phím WASD, phím mũi tên, hỗ trợ Telex tiếng Việt.

### File kiểm thử (Automated Tests):
- `src/simulation/levels-4-5-6.test.ts`: Bộ 8 tests tích hợp vật lý chuyên sâu cho Màn 4, 5, 6 (100% pass, sạch ESLint và TypeScript).
- `src/simulation/controller-regression.test.ts`: Kiểm tra lái thẳng, rẽ trái/phải đúng hướng cho cả 3 mẫu xe.
- `src/simulation/fixtures/runtime-samples.test.ts`: Kiểm tra tải và chạy các mẫu xe mặc định.

---

## 5. TRẠNG THÁI HỆ THỐNG HIỆN TẠI (SYSTEM STATUS)

- **Lệnh kiểm tra toàn diện (`npm run check`)**:
  - `npm run typecheck`: **0 errors** (TypeScript kiểm tra nghiêm ngặt không lỗi).
  - `npm run lint`: **0 errors, 0 warnings** (ESLint tuân thủ 100%).
  - `npm test`: **18 test files passed (119/119 tests passed)**.
  - `npm run test:boundary`: Kiến trúc building domain sạch sẽ, không vi phạm boundary.
  - `npm run test:event-boundary`: Event log foundation sạch sẽ.
  - `npm run build`: Bản dựng Vite production bundle thành công.
- **Dev Server**: Đang chạy tại `http://localhost:5173/`.
- **Tài liệu Walkthrough chi tiết**: [`walkthrough.md`](file:///c:/Users/ADMIN/Desktop/stem-simulator-ai/walkthrough.md).

---

## 6. GỢI Ý HÀNH ĐỘNG CHO PHIÊN CHAT MỚI (NEXT STEPS)

Khi mở một phiên chat mới, bạn có thể gửi tin nhắn:
> *"Tôi đã đính kèm file `CHAT_HANDOVER.md`. Hãy đọc file này để nắm toàn bộ ngữ cảnh dự án `stem-simulator-ai` và tiếp tục công việc."*

Một số hướng phát triển tiếp theo có thể thực hiện:
1. Thêm các bài học tương tác / hướng dẫn chi tiết từng bước (Tutorial step-by-step) cho học sinh trước mỗi màn chơi.
2. Thêm tính năng lưu và tải xe tự chế của học sinh vào LocalStorage (My Custom Vehicles).
3. Bổ sung thêm phụ kiện trang trí (đèn pha xe, cờ hiệu, còi xe bíp bíp, màu sơn tùy chọn).
4. Tối ưu hóa hiệu năng render Three.js trên các thiết bị máy tính bảng / điện thoại cấu hình thấp.
