Listed directory stem-simulator-ai
Ran command: `git clone https://github.com/fishperson113/3d-game-poc.git .`
Listed directory stem-simulator-ai
Viewed README.md:1-27
Viewed package.json:1-41
Ran command: `node -v; npm -v`
Ran command: `npm ci`
Listed directory docs
Listed directory src
Viewed main.ts:1-8
Viewed README.md:1-36
Used tool: manage_task
Listed directory app
Viewed bootstrap.ts:1-36
Ran command: `npm run typecheck`
Ran command: `npm run test`
Ran command: `npm run test:boundary && npm run test:event-boundary`
Ran command: `npm run test:boundary; npm run test:event-boundary`
Ran command: `npm run lint`
Used tool: manage_task
Used tool: manage_task
Viewed sandbox-application.ts:1-100
Viewed sandbox-application.ts:101-250
Viewed sandbox-application.ts:251-400
Used tool: manage_task
Viewed sandbox-application.ts:401-507
Used tool: manage_task
Listed directory parts
Viewed manifest.ts:1-100
Used tool: manage_task
Ran command: `npm run build`
Viewed app-view.ts:1-119
Ran command: `npm run part:validate`
Ran command: `node scripts/validate-part.mjs core.structural-block`
Listed directory tests
Listed directory e2e
Viewed sandbox.spec.ts:1-100
Viewed playwright.config.ts:1-12
Ran command: `npx vite --port 5173`
Used tool: manage_task
Browser task: "Explore Machine Sandbox UI and Controls"

Tôi đã hoàn tất việc clone repository, cài đặt môi trường, chạy kiểm thử toàn diện và tương tác thử nghiệm trực tiếp trên giao diện trình duyệt.

Dưới đây là báo cáo chi tiết về dự án, kết quả cài đặt và hướng dẫn sử dụng phần mềm.

---

## 1. Tổng quan về phần mềm

Dự án **Besiege-lite Web PoC** (Machine Sandbox) là một bản nguyên mẫu (Proof of Concept) trên nền web, lấy cảm hứng từ tựa game cơ khí vật lý nổi tiếng *Besiege*. Phần mềm cho phép người dùng tự do lắp ráp các cỗ máy / xe cộ từ các bộ phận cơ khí (khung sườn, trục bẻ lái, bánh xe gắn động cơ) và kích hoạt mô phỏng vật lý thời gian thực để trực tiếp lái thử nghiệm trên trình duyệt.

### Kiến trúc công nghệ cốt lõi:
- **Ngôn ngữ & Bundler**: TypeScript (chế độ Strict), Vite 8.
- **Vật lý thời gian thực**: [Rapier 3D](https://rapier.rs/) (`@dimforge/rapier3d-compat` chạy trên nền WebAssembly ở tần số cố định 60 Hz).
- **Đồ họa 3D**: Three.js (render trực tiếp WebGL, không phụ thuộc vào game engine nặng nề).
- **Kiến trúc mã nguồn**: Modular Clean Architecture / Ports & Adapters:
  - `src/kernel/`: Hợp đồng dữ liệu chung, hệ tọa độ, event envelopes, vòng đời runtime.
  - `src/building/`: Lõi logic lắp ráp (Blueprint, Socket matching, Ghost placement, Assembly solver).
  - `src/simulation/`: Trình biên dịch cỗ máy (từ Blueprint sang RigidBody, Joint, Actuator của Rapier) và bộ điều khiển vòng lặp vật lý.
  - `src/parts/`: Part Manifest, hệ thống socket kết nối và quản lý biến thể đồ họa (visual variant A/B).
  - `src/app/`: Composition root, View UI thuần (không dùng React/Vue để tối đa hiệu năng và tính nhỏ gọn).
  - `src/event-log/`: Cơ chế lưu vết sự kiện (Audit event log) với khả năng xuất JSON.

---

## 2. Quá trình Setup & Kiểm thử chất lượng

Tất cả các bước thiết lập và kiểm tra chất lượng (Quality Gates) đã được thực thi thành công:

1. **Clone mã nguồn**:
   ```bash
   git clone https://github.com/fishperson113/3d-game-poc.git .
   ```
2. **Cài đặt thư viện phụ thuộc**:
   ```bash
   npm ci
   ```
   *(Đã cài đặt 141 package thành công)*
3. **Kiểm tra kiểu dữ liệu (Typecheck)**:
   ```bash
   npm run typecheck
   ```
   *(TypeScript compilation kiểm tra hoàn toàn không có lỗi)*
4. **Chạy Unit & Regression Tests**:
   ```bash
   npm run test
   ```
   *(Toàn bộ **15 test suites** với **101 tests** đều PASS, bao gồm kiểm thử vật lý 4-wheel, 6-wheel, 8-wheel, giới hạn chống văng khớp nối và độ bền đóng kín blueprint)*
5. **Kiểm tra ranh giới kiến trúc (Architecture Boundaries)**:
   ```bash
   npm run test:boundary
   npm run test:event-boundary
   ```
   *(Đảm bảo domain logic chỉ sử dụng ES2023 thuần túy, hoàn toàn cách ly khỏi DOM và Three.js)*
6. **Kiểm tra Lint**:
   ```bash
   npm run lint
   ```
   *(ESLint pass 100%)*
7. **Biên dịch Production Bundle**:
   ```bash
   npm run build
   ```
8. **Máy chủ phát triển (Dev Server)**:
   Hiện tại máy chủ Vite đang chạy tại địa chỉ:
   ```
   http://localhost:5173/
   ```

---

## 3. Hướng dẫn sử dụng phần mềm

### A. Giao diện tổng quan

Khi mở `http://localhost:5173/`, giao diện được chia thành các khu vực:

```
+-----------------------------------------------------------------------------------------+
| [PLAN 04 / ASSEMBLY LAB] Machine Sandbox         Trạng thái: [BUILDING] [RAPIER 60HZ]   |
+-----------------------------------------------------------------------------------------+
| [Start] [Retry] [Stop] [Reset] | Sample: [Scout buggy... ▼] [Load selected]             |
+--------------------------+-----------------------------------+--------------------------+
| PALETTE (Bảng linh kiện) | 3D VIEWPORT                       | EVENT VIEWER             |
| - Structural block       | (Màn hình 3D tương tác Three.js)  | - Filter input           |
| - Powered wheel          |                                   | - [Export JSON]          |
| - Steering hinge         | Overlay nút lắp:                  | - Danh sách log sự kiện  |
|                          | [← socket] [socket →] [Rotate 90°]|   thời gian thực         |
| Hướng dẫn lái & lắp xe   | [Confirm connection] [Cancel]     |                          |
|                          |                                   |                          |
| INSPECTOR (Chi tiết khối)|                                   |                          |
| VISUAL QA (Variant A/B)  |                                   |                          |
+--------------------------+-----------------------------------+--------------------------+
```

---

### B. Thử nghiệm nhanh với các mẫu xe có sẵn (Presets)

Nếu muốn trải nghiệm lái thử xe ngay lập tức:
1. Tại thanh công cụ trên cùng, tìm mục **Sample**.
2. Mở danh sách thả xuống và chọn một trong ba cấu hình mẫu:
   - `Scout buggy`: Xe thám hiểm 4 bánh gọn nhẹ, dẫn động và bẻ lái phía trước.
   - `Six-wheel hauler`: Xe tải 6 bánh thân dài đầm và ổn định.
   - `Eight-wheel crawler`: Xe 8 bánh vượt địa hình với 3 khối khung sườn liên kết.
3. Nhấp nút **Load selected**. Xe mẫu sẽ xuất hiện ngay lập tức trên sàn 3D.
4. Nhấp nút **Start** để kích hoạt động cơ vật lý.

---

### C. Phím tắt điều khiển lái xe (Chế độ Simulation)

Sau khi nhấn **Start** (trạng thái hiển thị là `RUNNING`):
| Phím bấm | Chức năng |
|---|---|
| <kbd>W</kbd> hoặc <kbd>↑</kbd> | Đạp ga tiến về phía trước (`throttle = 1`) |
| <kbd>S</kbd> hoặc <kbd>↓</kbd> | Lùi xe / phanh (`throttle = -1`) |
| <kbd>A</kbd> hoặc <kbd>←</kbd> | Bẻ lái sang trái (`steering = -1`) |
| <kbd>D</kbd> hoặc <kbd>→</kbd> | Bẻ lái sang phải (`steering = 1`) |

- Nhấn **Stop**: Dừng mô phỏng vật lý, đưa xe trở lại vị trí thiết kế gốc (giữ nguyên blueprint).
- Nhấn **Reset**: Xóa bỏ cỗ máy về trạng thái trống ban đầu để dựng lại từ đầu.

---

### D. Tự lắp ráp xe từ đầu (Chế độ Building)

Khi trạng thái là `BUILDING`:
1. **Đặt khung gầm chính (Root Chassis)**:
   - Trong bảng **Palette** bên trái, nhấp chọn **Structural block**. Khối đầu tiên sẽ tự động làm gốc tọa độ của cỗ máy.
2. **Gắn thêm khớp bẻ lái (Steering Hinge)**:
   - Nhấp chọn **Steering hinge** trong Palette.
   - Một khối ảo (ghost) màu xanh lục sẽ hiển thị tại các vị trí socket tương thích (ví dụ `mount-front-left`).
   - Có thể nhấp **← socket** hoặc **socket →** trên màn hình 3D để đổi sang vị trí gắn khác.
   - Nhấn **Confirm connection** (hoặc phím <kbd>R</kbd> để xoay hướng khối 90° nếu cần) để cố định khớp nối.
3. **Gắn bánh xe động cơ (Powered Wheel)**:
   - Nhấp chọn **Powered wheel**.
   - Di chuyển socket tới `hinge-1:axle` (để bánh trước xoay theo góc lái) hoặc tới các mount phía sau khung sườn (`mount-rear-left`, `mount-rear-right`).
   - Nhấn **Confirm connection**.
4. **Thao tác nhanh bằng bàn phím trong Build mode**:
   - <kbd>R</kbd>: Xoay khối ảo 90°.
   - <kbd>Esc</kbd>: Hủy thao tác đặt khối đang chờ.
   - <kbd>Delete</kbd>: Xóa khối đang được chọn (chọn khối bằng cách nhấp chuột trực tiếp vào khối đó trong khung nhìn 3D).
5. **Kiểm tra thông số trong Inspector**:
   - Nhấp chuột vào bất kỳ bộ phận nào trong khung 3D, thanh **Inspector** bên trái sẽ hiển thị tọa độ $[x, y, z]$, mô-men xoắn (`motorTorque`), danh sách các socket liên kết và nút **disconnect** từng mối nối.

---

### E. Kiểm tra Visual QA & Xuất Log

- **Visual QA**: Cho phép đổi nhanh giữa mô hình `Variant A` và `Variant B` của từng linh kiện trực tiếp trên màn hình mà không ảnh hưởng tới thuộc tính vật lý.
- **Event Viewer & Export JSON**: Mọi tương tác phím, va chạm vật lý, thay đổi khối đều được ghi lại theo chuỗi sự kiện. Bạn có thể gõ từ khóa lọc (như `physics.*`, `input.*`) hoặc bấm **Export JSON** để tải file log sự kiện về máy.

---

## 4. Bảng tóm tắt các lệnh hữu ích trong dự án

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Khởi chạy máy chủ phát triển Vite với Hot Module Replacement |
| `npm run build` | Kiểm tra type và đóng gói ứng dụng vào thư mục `dist/` |
| `npm run preview` | Chạy thử bản build production cục bộ |
| `npm run test` | Chạy 101 bộ test unit và physics regression qua Vitest |
| `npm run test:e2e` | Chạy kiểm thử tự động toàn diện trên trình duyệt thật qua Playwright |
| `npm run check` | Bộ kiểm tra chất lượng tổng hợp (Typecheck + Lint + Unit test + Boundary check + Build) |
| `npm run part:validate -- <part-id>` | Kiểm tra tính hợp lệ của manifest một linh kiện (VD: `core.structural-block`) |