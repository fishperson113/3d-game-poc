# Plan 04 — Component có thể thay model và sandbox lắp ráp/lái xe

Ngày lập: 2026-09-09. Trạng thái: **IMPLEMENTED — runtime acceptance đã đóng; strict img2threejs authoring limitation được ghi rõ ở [part-model-replacement.md](./part-model-replacement.md)**.

## 1. Đầu ra và phạm vi đã thống nhất

Theo yêu cầu bổ sung của user, Plan 04 được mở rộng từ asset pipeline thành một sandbox chạy bằng `npm run dev`: chọn component → lắp thành xe → Start → tiến/lùi/rẽ → Stop/Reset → sửa thiết kế. **Điều kiện đóng cuối cùng là chứng minh thay visual 3D mà không phải sửa blueprint, assembly hoặc physics.** Chỉ lái được xe chưa đủ để close.

Plan 03 (content/challenge) để sau: không cần load level, goal, timeout, win/lose hay sửa Challenge module để chạy sandbox này. Môi trường thử là ground phẳng, spawn và một ramp nhỏ được khai báo bằng fixture dữ liệu của simulation. Đây không phải một LoadedLevel giả hoặc bản triển khai thứ hai của Challenge.

Controller mặc định của scope này là keyboard qua `InputSource`: W/S hoặc ↑/↓ cho drive, A/D hoặc ←/→ cho steer. Tay cầm vật lý/Gamepad API chưa được yêu cầu rõ và không nằm trong acceptance hiện tại.

Giữ Vanilla TypeScript, Three.js trực tiếp và Rapier; không thêm UI framework. Plans 01–02 giữ behavior đã đóng. Plan 04 này nhận phần sandbox/editor/physics cần thiết vốn ở Plan 05; Plan 05 sau đó tích hợp Challenge thật vào runtime đã có.

## 2. Căn cứ từ codebase

| Khu vực | Hiện trạng | Công việc cần làm |
|---|---|---|
| `building/domain` và `MachineBuildingService` | Có add/remove/move/rotate/connect/configure/bind, snapshot và khóa simulation | Tái sử dụng; thêm thao tác đặt-và-gắn atomic nếu cần |
| `building/domain/part-definition.ts` | Có sockets, capabilities, configuration schema; chưa có physics spec | Giữ Building chỉ cần assembly/config; bổ sung runtime DTO ở parts/simulation |
| `parts/*/definition.ts` | Có ba ID `core.structural-block`, `core.powered-wheel`, `core.steering-hinge` | Hoàn thiện sockets thực, manifest, colliders, visual adapters |
| `parts/catalog.ts` | Lookup definition, validation còn TODO | Parse/validate catalog atomic và index ổn định |
| `building/fixtures/four-wheel-*` | Fixture domain dùng socket ở `[0,0,0]`, pose không chứng minh joint anchors khớp | Giữ tests domain; tạo fixture runtime riêng từ authoritative sockets |
| `simulation/application/*`, `adapters/rapier/*` | Compiler/session/world là scaffold | Implement compile, motors, fixed-step, lifecycle |
| `adapters/three/*`, `app/*` | Scene/UI/composition còn scaffold | Editor, visual registry, camera, input, Start/Reset và event wiring |
| `scripts/validate-part.mjs`, `part-qa.mjs` | Kiểm tra manifest tối thiểu, wrapper QA sơ bộ | Dùng validator chung; test selection đúng và chạy được trên Windows |
| `tools/img2threejs.lock.json` | Đã pin SHA cụ thể | Verify checkout/provenance lúc authoring; không chạy generator khi dev/build |

Baseline trước khi sửa đã kiểm chứng: `npm run check` pass, 9 files / 73 tests. Sau triển khai, regression Node là 12 files / 79 tests; browser e2e và part QA được ghi ở mục evidence cuối tài liệu.

## 3. Ownership và thay đổi contract

Phần asset: `src/parts/**`, part visual adapters ở `src/adapters/three/**`, `art-source/parts/**`, evidence có chọn lọc trong `work/img2threejs/**`, tooling lock và scripts part validate/preview/QA.

Phần sandbox được bổ sung: `src/simulation/**`, `src/adapters/rapier/**`, `src/adapters/input/**`, renderer/editor ở `src/adapters/three/**`, `src/app/**`, `src/main.ts`, `src/styles.css`, `tests/e2e/**`, Vite/preview config và npm scripts liên quan.

Shared changes chỉ gồm contract thực sự cần thiết và tests tại module sở hữu: bổ sung thao tác assembly atomic trong Building; thêm trạng thái boot sandbox nếu runtime cần; thêm physics DTO/ports. Không thay blueprint schema chỉ để lưu mesh/visual revision. Không sửa `src/challenge/**` hoặc content Plan 03.

Các bước làm tuần tự vì cùng dùng lifecycle scene/session. Không chia agents chạy đồng thời theo các thư mục renderer/compiler/UI.

## 4. Contract thay model bắt buộc

### 4.1 Tách ba nguồn dữ liệu

1. **Assembly:** stable definition ID, socket IDs, local positions/orientations, compatibility, control capabilities. Blueprint tham chiếu những ID này.
2. **Physics:** explicit body/collider/joint/motor settings có đơn vị. Không lấy collider/mass hoặc joint anchor từ mesh bounds, tên node hay generated hints.
3. **Visual:** visual key/revision → registry → adapter → factory. Chỉ adapter import generated file. Thay visual không đổi hai lớp trên.

Manifest schema v1 là nguồn authoring có version. Parser tạo các immutable projections: `PartDefinition` cho Building, physics definition cho compiler, visual reference cho renderer. Không duy trì sockets/colliders JSON và TS bằng hai bản sao sửa tay độc lập. Nếu tách file sockets/colliders, phải có một đường compose/validate duy nhất.

Part runtime catalog implement `PartCatalog` hiện có, đồng thời cung cấp lookup physics metadata qua port nhỏ. Compiler import DTO/port, không import concrete catalog hoặc Three factory. Visual registry là static mapping, không import arbitrary URL/path từ manifest.

### 4.2 Transform và chuyển động

- Một unit = một mét; Y-up, xe tiến theo +Z; góc tính bằng radians. Euler ở blueprint có convention xác định, chuyển sang quaternion ở adapter/compiler.
- Mỗi part có root chuẩn theo authoritative part frame. Model cần đổi scale/origin/up-axis được normalize ở visual child, không scale root part hoặc sửa socket để chiều theo model.
- Wheel axle local +X, steering local +Y; socket frames phải xác định đầy đủ hướng. Chiều motor của wheel bên trái/phải tính theo mount transform/binding sign, không đoán từ tên part instance.
- `PartVisualFactory.create()` trả visual instance mới có root và `dispose()` idempotent. Factory không tạo scene/camera/light/renderer/RAF/global listener.
- Renderer map `partId` → visual root. Wheel và hinge nhận body transforms từ physics frame; không vừa quay body vừa cộng wheel animation một lần nữa.
- Nếu visual có chi tiết tĩnh/chuyển động tách rời, adapter ánh xạ semantic mount/rotor pivots từ contract; không để simulation biết hierarchy của model.
- Picking gắn semantic `partId` tại adapter; snap và debug overlay lấy authoritative sockets/colliders. Đổi mesh hierarchy vẫn chọn và gắn part được.
- Visual revision độc lập gameplay revision. Thay socket/collider là thay gameplay contract và cần migration/compatibility review riêng, không gọi là thay visual.

### 4.3 Bài kiểm chứng thay model

Chuẩn bị visual A đơn giản và B có hình học khác rõ ràng cho từng loại part; giữ nguyên definition ID, sockets, physics và bindings. B cũng tuân thủ normalization và provenance, không chỉ đổi màu.

Trong Build mode cho chọn visual variant dùng cho QA; không lưu variant vào blueprint. Với cùng blueprint: chạy A, reset, đổi sang B, chạy lại. Không yêu cầu hot-swap giữa lúc Running.

Pass khi blueprint JSON và compiled physics specification không đổi; headless chạy cùng inputs/steps cho kết quả bằng nhau trong tolerance đã khai báo; browser thấy model khác nhưng vị trí ráp, axle, steering và picking đúng. Có before/after screenshots cùng camera và hướng dẫn thay model thực tế. Nếu chưa làm được bài này, Plan 04 chưa close.

## 5. Bộ component tối thiểu

| ID giữ ổn định | Hình thức ban đầu | Assembly và behavior |
|---|---|---|
| `core.structural-block` | Khối vuông kiểu block, ghép nhiều khối thành khung | Sockets trên các mặt, fixed connections; collider cuboid |
| `core.powered-wheel` | Bánh đơn giản có hub dễ thấy | Axle socket, revolute motor tạo lực kéo; collider tròn đơn giản explicit |
| `core.steering-hinge` | Khớp lái dạng block nhỏ | Mount/axle sockets; steering servo quanh Y, wheel quay độc lập quanh X |

Kích thước, khối lượng, friction, torque/velocity và steering limit là dữ liệu explicit được chốt ở bước 1–2, có range validation. Dùng `motorTorque` và `steeringLimitRadians` hiện có với semantics rõ; bổ sung speed/force settings khi physics cần, không hard-code theo model.

Xe mẫu mới có chassis ghép từ nhiều blocks, bốn powered wheels và hai steering hinges trước. Đây là fixture tiện dùng, không thay thế acceptance user tự ghép xe từ palette.

## 6. Thứ tự triển khai codebase

### Bước 1 — Contract và manifest validation

- Thêm manifest parser từ `unknown`, error code + JSON path; validate ID/version, finite transforms, positive dimensions/mass, friction/motor ranges, normalized non-zero axes, joint limits, unique sockets và capability references.
- Xác định collision filtering giữa parts nối nhau để joint không bị collider tự đẩy tách. Ghi rõ mount frame và khoảng hở bánh/khung.
- Tạo physics DTO/lookup port và visual adapter contracts ở module đúng ownership; giữ domain không kéo Three/Rapier/DOM.
- Catalog registration atomic: part invalid không để runtime nhìn thấy catalog nửa hợp lệ. Emit `asset.part.loaded`/structured failure bằng shared event infrastructure.
- Kiểm chứng negative manifests, duplicate IDs, undefined visual keys và import boundary; config cũ của Building vẫn dùng được.

Checkpoint đạt: ba manifest được parse atomic từ JSON authoritative; negative duplicate socket/normalization tests pass; catalog không lộ state nửa hợp lệ.

### Bước 2 — Visual pipeline và isolated preview

- Đọc skill img2threejs được pin trước khi generation; verify installer và `.source-commit` theo lock. Tạo briefs/reference có provenance cho ba part và variants dùng thử thay model.
- Chạy staged strict-quality flow, commit generated factories và provenance thật; sửa spec/regenerate thay vì sửa tay file generated khi có source spec.
- Làm stable visual adapters, normalization và disposal ownership; generated resource không bị dispose bởi instance khác. Ban đầu ưu tiên resource riêng từng instance cho dễ chứng minh lifecycle.
- Hoàn thiện preview entry riêng: grid một mét, axes, sockets có hướng, collider wireframes, pivot markers, metrics, variant selection và dispose/remount.
- `part:preview -- <id>` phải được wrapper parse thành lựa chọn part thực; không giả định Vite nhận positional part ID như option ứng dụng. Test QA wrapper trên Windows.
- Nếu pin/pipeline bị chặn, ghi limitation cụ thể; có thể tiếp tục physics với visual placeholder được đánh dấu rõ, nhưng không ghi asset pipeline đã pass hoặc giả provenance.

Checkpoint đạt một phần có giới hạn: `part:qa` cho ba part pass và isolated preview đã kiểm tra thực tế với sockets/colliders/variant. Strict img2threejs staged quality không được claim vì thiếu reference image có license/SHA và checkout git reproducible; xem [part-model-replacement.md](./part-model-replacement.md).

### Bước 3 — Assembly solver và fixture runtime

- Viết solver thuần math: target world socket frame + mating rotation + inverse source socket frame → proposed part transform. Không snap theo mesh bounds.
- Root block đặt trên build grid; part tiếp theo chọn source socket và target socket tương thích, có ghost xanh/đỏ, preview rotation 90° và confirm/cancel.
- Dùng một thao tác atomic đặt-và-gắn: validate proposed part, connection và default bindings trên candidate state trước một lần save. Reject không để lại orphan part/connection hoặc phát success events cho state chưa commit.
- Giữ add/move/rotate/connect hiện có. Với part đã nối: UI yêu cầu disconnect trước move/rotate ở bản đầu, hoặc thao tác reattach atomic; không âm thầm kéo lệch joint anchors.
- Default drive/steer bindings theo capabilities được hiển thị trong inspector; user thấy part nào nhận action, có thể đổi sign khi cần.
- Tạo fixture ở vùng parts/simulation từ cùng catalog/solver, không sử dụng socket giả của `FourWheelFixtureCatalog` làm chuẩn vật lý.
- Compile preflight reject disconnected machine, missing binding target, anchor lệch hoặc trục không hợp lệ bằng lỗi cụ thể. Tolerance anchors/axis có constants và tests.

Checkpoint đạt: browser e2e tự tạo chassis + 2 steering hinges + 4 wheels từ palette; solver dùng socket frames; placement atomic và ghost confirm/cancel/rotate/cycle socket hoạt động.

### Bước 4 — Sandbox physics và compiler

- Tạo `SimulationEnvironment` thuần dữ liệu: gravity, static ground/ramp, spawn. `LoadedLevel` sau này được adapter chuyển thành DTO này trong Plan 05; sandbox không phụ thuộc Challenge.
- Mở rộng `PhysicsWorld` port cho create bodies/colliders/joints, motor commands và transform snapshots bằng stable IDs; Rapier handles giữ private trong adapter.
- Init Rapier một lần; compile stable ordering từ immutable blueprint + catalog physics + environment. Validate toàn bộ trước allocation, rollback/dispose nếu allocation thất bại giữa chừng.
- Structural connections fixed; hinge steering revolute có limits/servo; wheel spin revolute có velocity target và force/torque bound. Chọn joint role từ socket/capability metadata, không if theo instance ID.
- Physics QA fix: collider của các part trong cùng machine dùng collision filtering để không tự va chạm với nhau nhưng vẫn va chạm ground/ramp; root spawn là `y=0.75` để wheel radius `0.48` và mount offset `-0.25` bắt đầu sát ground. Solver ưu tiên `axle` của steering hinge khi palette tự chọn candidate đầu tiên.
- Compile bindings thành runtime actuator map. Test trái/phải được lắp đối xứng nhưng forward cùng đẩy xe theo +Z; steering tôn trọng giới hạn.
- Headless fixture tests trên ground: settle, drive, reverse, steer và không có NaN/joint explosion; thêm ramp để kiểm tra tiếp xúc thật. Mức displacement/yaw tối thiểu được ghi trước khi chốt tuning; không chỉ assert bánh có quay.

Checkpoint đạt: headless Rapier test chứng minh forward displacement, reverse displacement và heading change; compiler chỉ nhận blueprint + physics catalog + environment, không import visual factory.

### Bước 5 — Session, input và reset

- Implement accumulator 1/60 với bounded catch-up, timestep clamp và snapshots. Một owner RAF ở app; không tạo loop trong visual factory hoặc mỗi session.
- Keyboard read trả drive/steer chuẩn hóa [-1,1]; keyup, blur, visibility change và dispose phải zero input. Bỏ qua shortcut khi đang nhập inspector field.
- Runtime telemetry đi qua cùng event envelope/sequence/event bus: `input.control.changed` ghi source, phase, code, pressed keys và controls chuẩn hóa; `input.control.reset` ghi lý do reset; `simulation.controls.applied` ghi controls đã được áp vào fixed step.
- Start dùng `acquireSimulationSnapshot`; compile thành công mới Running. Compile fail dispose world đã tạo và `releaseSimulation`, trả về Building cùng lỗi.
- Stop/Reset dispose session resources và dựng lại build pose từ snapshot; không copy transform vật lý ngược vào blueprint. Reset không tạo challenge failure.
- Rapier drain collision queue thành `physics.collision.started/stopped` với semantic part/environment IDs và physics step; raw Rapier handles không đi vào Event Log.
- Sandbox lifecycle: boot assets → Building → Compiling → Running → Building; lỗi khởi tạo có retry rõ. Không dựng Completed/Failed giả khi chưa có Challenge.

Checkpoint đạt: session fixed 1/60 bounded catch-up; input reset ở keyup/blur/visibility/dispose; e2e quan sát 20 vòng sau warm-up với world/input baseline bằng 0, một RAF owner và renderer WebGL resource counts ổn định.

### Bước 6 — Giao diện chạy bằng npm run dev

- Thay bootstrap placeholder bằng viewport 3D, palette ba parts, inspector selection/config/binding, toolbar Start/Stop/Reset/load sample và trạng thái lỗi thao tác.
- Orbit/zoom camera, picking và ghost placement; highlight socket đang chọn. Phím R xoay preview, Escape hủy, Delete xóa selection chỉ trong Building.
- Load sample phục vụ kiểm tra nhanh; luồng build từ root block trống vẫn đầy đủ. Running khóa commands sửa máy; hiển thị hướng dẫn keyboard.
- Wire bus/registry/memory/console với cùng sequence source cho Building, assets và simulation; reporter diagnostics dùng cấu hình đã kiểm thử Plan 01. Event viewer tối thiểu có filter/export, lifecycle và command rejection.
- Event viewer lọc được trực tiếp `input.*` và `physics.*`, nên có thể debug input keydown/keyup, controls áp dụng theo step và tiếp xúc giữa part với ground/ramp từ cùng UI.
- Khi Start/Reset, create/dispose visual ownership rõ; không yêu cầu browser reload giữa hai lần chạy. HMR/app teardown cũng dispose listeners, renderer và session.
- Không cần backend, API key, Python hoặc checkout img2threejs để chạy source visual đã commit.

Checkpoint đạt: `npm run dev` được mở bằng Chrome thực tế; UI có palette/inspector/ghost/feedback/event viewer/orbit viewport, tự lắp và keyboard drive/steer. `npm run part:preview -- core.structural-block` cũng đã mở isolated preview thực tế.

### Bước 7 — Chứng minh thay model và đóng plan

- Chạy bài A/B ở mục 4.3 cho cả block, wheel và hinge. Bao gồm model thay đổi local hierarchy để bắt dependency vào tên mesh.
- Export/import blueprint qua codec hiện có trong test; blueprint trước thay visual vẫn dùng được. UI persistence đầy đủ không bắt buộc ở chặng này.
- E2E tự lắp qua palette, connect, Start, drive/steer, Reset và re-edit; test fixture shortcut riêng. Không chỉ click Load sample rồi coi editor đã được kiểm chứng.
- Chạy lifecycle ít nhất 20 vòng sau warm-up; active listener/RAF/world counts trở về baseline, renderer memory không tăng tuyến tính; có ảnh và số đo kiểm chứng.
- Viết `docs/part-model-replacement.md`: file nào thay, file nào giữ, normalize/pivots, provenance, QA commands và cách rollback visual revision.
- Chạy `npm run part:qa -- core.structural-block`, `core.powered-wheel`, `core.steering-hinge`; `npm run check`; `npm run test:e2e`.

## 7. Evidence và điều kiện close

Đã kiểm chứng ngày 2026-09-09:

| Kiểm tra | Kết quả |
|---|---|
| `npm run part:qa -- core.structural-block` | pass: manifest/provenance + 3 manifest/catalog tests |
| `npm run part:qa -- core.powered-wheel` | pass: manifest/provenance + 3 manifest/catalog tests |
| `npm run part:qa -- core.steering-hinge` | pass: manifest/provenance + 3 manifest/catalog tests |
| `npm run test` | pass: 12 files / 79 tests |
| `npm run check` | pass: typecheck, lint, 12 files / 79 tests, boundary checks và production build |
| `npm run test:e2e` | pass trên Chrome: tự lắp từ palette với wheel-to-axle layout, giữ W+D có control telemetry và displacement, Reset, A/B, 20 Start/Reset cycles và responsive desktop/tablet/mobile không có page scrollbar |
| event telemetry trong Event Log | pass bằng computer use trên production preview: Start hiện `physics.collision.started` với semantic body IDs; phím W hiện `input.control.changed` cho keydown/keyup; Reset hiện `simulation.reset` và `building.simulation.snapshot-released` |
| physics stability | pass: sau 90 fixed steps không control, chassis drift mỗi trục < 0.15 m và nghiêng < 0.08 quaternion component; headless drive/steer/reverse pass; collider self-contact đã được loại bỏ |
| browser computer-use QA | pass trên production preview: Load sample → Start → Reset; sau Reset AX state là BUILDING, active physics worlds `0`, input listeners `0`, blueprint pose giữ `y=0.75` |
| screenshots | A/B khác SHA, cùng viewport/camera: A `FCCCBEC1BDFE5C42B881DB71C255971AA2DFE711EDAEFF792F383F16543DF62B`, B `C7C762279F6444674285803DB1C6DD2AB318CC747F8D2618138DF3511C432CF3` |
| `npm run dev` | pass: sandbox Build mode mở được và thao tác được trên browser |
| `npm run part:preview -- core.structural-block` | pass: isolated preview A/B + sockets/colliders/provenance |

- [x] Ba loại component được validate, có authoritative sockets/colliders và provenance; quality limitation được ghi rõ, không giả strict-quality pass.
- [x] User tự ráp chassis nhiều blocks + bốn bánh + steering bằng UI; invalid assembly bị reject atomic.
- [x] `npm run dev` mở sandbox được ngay, không chờ Plan 03.
- [x] Xe tiến/lùi/rẽ thật bằng keyboard và motor physics.
- [x] Start/Stop/Reset giữ blueprint và không leak resources qua repeated cycles.
- [x] Đổi visual A/B cho cả ba loại part không sửa definition ID, sockets, colliders, compiler hoặc blueprint.
- [x] Before/after giữ cùng compiled physics spec và behavior trong tolerance; picking/assembly vẫn hoạt động.
- [x] Asset preview, part QA, Node regression và browser e2e pass; có hướng dẫn thay model được thử thực tế.
- [x] Limitation img2threejs được ghi rõ trong closure.

## 8. Handoff về sau

Plan 03 triển khai content/challenge độc lập khi tới lượt. Plan 05 dùng loader/evaluator đó và chuyển LoadedLevel thành SimulationEnvironment, thêm semantic trigger/timeout/result/HUD. Không viết lại sandbox editor/compiler/visual registry và không yêu cầu asset authoring tool trong runtime.

GLB loader, gamepad, undo/redo đầy đủ, save-library UI, destruction, suspension và map editor không thuộc acceptance này. Adapter cho model định dạng khác chỉ thêm khi thực sự dùng; contract thay visual hiện tại phải được chứng minh bằng hai factory khác nhau trước.
