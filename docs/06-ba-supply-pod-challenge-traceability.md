# BA traceability — Supply Pod challenge và hệ thống hiện tại

## 1. Mục đích

Tài liệu này đối chiếu kịch bản **Supply Pod qua vùng ngập** do BA cung cấp với những khái niệm, màn hình, dữ liệu và logic đang tồn tại trong repository.

Mục tiêu là trả lời theo từng thuật ngữ:

1. BA đang gọi đối tượng hoặc hành vi đó là gì?
2. Trong sản phẩm hiện tại, khái niệm gần nhất là gì?
3. Đây là tương đương thật sự hay chỉ giống nhau về giao diện?
4. Khoảng trống tối thiểu cần xử lý là gì?

Tài liệu này là tài liệu phân tích, **không phải xác nhận rằng mọi nghiệp vụ đã được triển khai**.

## 2. Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| ✅ Đã có | Hành vi và dữ liệu hiện tại đáp ứng trực tiếp ý BA |
| 🟡 Tương đương | Cùng vai trò nghiệp vụ nhưng tên gọi hoặc cách thể hiện khác |
| 🟠 Một phần | Đã có UI hoặc một phần logic, chưa đủ điều kiện nghiệp vụ |
| ❌ Chưa có | Chưa có dữ liệu hoặc logic tương ứng |
| 🚫 Ngoài MVP | Không nên bổ sung trong phạm vi challenge đầu tiên |

## 3. Từ điển BA ↔ repository

| Từ/cụm từ của BA | Ý nghĩa theo BA | Khái niệm hiện có trong repo | Mức tương ứng | Ghi chú |
|---|---|---|---|---|
| BuildLoop | Nền tảng trẻ nhận mission, lập kế hoạch, build, test và reflection | STEM Car Lab / Besiege-lite Web PoC | 🟡 Tương đương | Tên sản phẩm khác, vòng lặp build–test đã tồn tại |
| Challenge | Một nhiệm vụ kỹ thuật có bối cảnh, luật và điều kiện thành công | `ChallengeDefinition` | ✅ Đã có | Khai báo tại `src/challenge/domain/contracts.ts` |
| Mission | Mục tiêu mà trẻ phải hoàn thành | `description`, `goalZone`, evaluator | ✅ Đã có | Màn 2 đánh giá vị trí của Supply Pod thay vì chassis |
| BuildLoop Core Kit | Tập linh kiện vật lý được phép sử dụng | Part catalog gồm 8 loại phụ tùng | 🟡 Tương đương | Danh mục nằm trong `src/parts/` và palette trong `src/app/ui/app-view.ts` |
| Supply Pod | Hộp vật tư 100g cần được vận chuyển | `core.supply-pod` | ✅ Đã có | Body độc lập 0,1 kg, có collider và visual riêng; không thuộc blueprint và không gắn joint vào xe |
| Base Camp | Vị trí xuất phát của hệ thống và Supply Pod | `environment.spawn` | 🟡 Tương đương | Mỗi challenge đã có tọa độ spawn |
| Rescue Zone | Khu vực đích phải chứa hoàn toàn Supply Pod | `environment.goalZone` | 🟠 Một phần | Màn 2 đã kiểm tra tâm Supply Pod; chưa kiểm tra toàn bộ kích thước hộp nằm trong zone |
| Flood Zone | Dải nguy hiểm mà Supply Pod không được chạm | Khoảng trống trong challenge `the-gap` | 🟡 Tương đương | Địa hình Màn 2 đã có hai bờ và khoảng trống ở giữa; chưa có semantic/trigger riêng tên Flood Zone |
| Start Line | Ranh giới trẻ phải đứng sau khi test bắt đầu | Vạch xuất phát trong môi trường số | 🟠 Một phần | Có ý nghĩa hình ảnh/spawn; ứng dụng không thể biết vị trí cơ thể trẻ ngoài đời |
| Rescue mission | Bối cảnh xã hội tạo mục tiêu cho challenge | Chưa có trong wording hiện tại | ❌ Chưa có | Màn 2 hiện dùng bối cảnh “vực thẳm” |
| Mobile carrier | Phương tiện mang payload di chuyển trên bề mặt | Xe do trẻ lắp từ khung, bánh, động cơ và khớp lái | ✅ Đã có | Đây là solution family được hỗ trợ tốt nhất |
| Fixed path/structure | Cầu, ray hoặc máng đứng yên | Dầm/khung trong machine blueprint | 🟠 Một phần | Part có nhưng toàn bộ blueprint được compile như một machine động; chưa có điểm neo/cấu trúc tĩnh do trẻ xây |
| Suspended transfer | Dây, ròng rọc hoặc tời đưa payload trên cao | Không có dây, tời, pulley hoặc anchor | ❌ Chưa có | Không thêm trong MVP vì BA yêu cầu không sáng tạo component |
| Hybrid | Kết hợp nhiều cơ chế | Xe có thể kết hợp bánh, xích, dầm, bánh răng | 🟠 Một phần | Hỗ trợ hybrid trong phạm vi vehicle; chưa hỗ trợ hybrid dây/cầu tĩnh |
| Version 1 | Thiết kế và kết quả test lần đầu | Mỗi lần `start`/`retry` của simulation | 🟠 Một phần | Có attempt trong AI state nhưng chưa lưu một bản ghi V1 đầy đủ |
| Version 2 | Thiết kế sau khi thay đổi một biến | Lần test sau khi quay lại xưởng | 🟠 Một phần | Có thể sửa blueprint và chạy lại; chưa có snapshot/bảng so sánh V1–V2 |
| Variable changed | Một biến thiết kế chính được trẻ chủ động thay đổi | Thay part/configuration/placement trong blueprint | 🟠 Một phần | Engine cho phép thay đổi nhưng UI chưa yêu cầu trẻ khai báo đúng một biến |
| Component efficiency | Số linh kiện sử dụng | `blueprint.parts.length` | ✅ Có dữ liệu | Chưa lưu theo từng version và chưa đưa vào report |
| Test | Một lần chạy thiết kế trên field | Runtime state `Running`, `RealtimeChallengeEvaluator` | ✅ Đã có | Bắt đầu bằng nút Chơi và kết thúc khi đạt đích/rơi/dừng |
| Time limit | Tối đa 60 giây cho một lần test | `targetTimeSeconds` và `elapsedSeconds` | 🟠 Một phần | Engine có timer và mốc tính sao; chưa có hard timeout 60 giây cho mission này |
| Distance completed | Quãng đường Supply Pod đã đi | `distanceToGoal` trong `EvaluationSnapshot` | 🟠 Một phần | Được tính trong lúc chạy nhưng chưa lưu thành kết quả attempt và đang dựa vào chassis |
| System stable | Hệ thống không lật, gãy, kẹt hoặc mất cân bằng | Physics diagnostics theo position/rotation | 🟠 Một phần | Có thể phát hiện một số trạng thái xe; chưa đánh giá stability của payload theo từng test |
| Payload dropped | Supply Pod rơi khỏi carrier | Free physics body `supply-pod` | ✅ Đã có physics | Pod có thể rơi, trượt, nảy và văng vì không có joint; diagnosis/report cho sự kiện rơi vẫn chưa có |
| Hint Level | Mức hỗ trợ tăng dần, ưu tiên câu hỏi Socratic | `HintTier` và `SocraticTutor` gồm 5 tầng | ✅ Đã có nền tảng | Một số hint hiện vẫn nói thẳng component/giải pháp, chưa đúng wording BA |
| Adult intervention | Số lần người lớn hỗ trợ | Không có event hoặc form ghi nhận | ❌ Chưa có | MVP có thể cho tự khai báo; hệ thống không thể tự quan sát ngoài đời |
| Reflection | Trẻ giải thích thay đổi và bằng chứng | AI Tutor có hội thoại/hint | 🟠 Một phần | Chưa có bước reflection có cấu trúc và chưa lưu câu trả lời |
| Skill Report | Báo cáo năng lực dựa trên V1/V2 và mức hỗ trợ | Parent report và `ParentInsightsEvaluator` | 🟠 Một phần | UI đã có nhưng report chưa lấy đầy đủ evidence từ hai test record |
| Controlled experimentation | Chỉ thay đổi một biến và so sánh bằng chứng | Chưa có domain model tương ứng | ❌ Chưa có | Đây là learning outcome mới cần được biểu diễn trong attempt/version data |

## 4. Đối chiếu bối cảnh và challenge statement

| Nội dung BA | Hệ thống hiện tại | Đánh giá |
|---|---|---|
| “Sau một trận mưa lớn, khu dân cư bị cô lập” | Màn 2 có hai vùng đất bị ngăn bởi một khoảng trống | 🟡 Có thể đổi narrative mà không đổi topology |
| “Người dân cần hộp vật tư chứa bộ lọc nước” | Màn 2 “Tiếp Tế Qua Vùng Ngập” và visual Supply Pod | ✅ Đã có narrative/payload cơ bản |
| “Đưa Supply Pod từ Base Camp đến Rescue Zone” | Pod spawn phía trên xe và evaluator dùng transform của pod | ✅ Đã có luồng vật lý A→B cơ bản |
| “Supply Pod nặng 100g” | `core.supply-pod` có mass `0.1` | ✅ Đã có trong physics scale hiện tại |
| “Hộp hàng không chạm Flood Zone” | Xe thất bại khi root rơi dưới `failThresholdY` | 🟠 Chưa theo dõi riêng Hộp pin và chưa có Flood Zone trigger |
| “Không trực tiếp cầm/đẩy hộp sau khi test bắt đầu” | Khi Running, trẻ điều khiển bằng W/A/S/D; editor không phải luồng chính | 🟡 Trong mô phỏng có thể coi nút điều khiển là tương đương thao tác từ Start Zone |
| “Không cho xem mô hình mẫu” | Menu “Xe có sẵn” vẫn tồn tại; challenge card còn nêu component nên dùng | ❌ Hiện tại đang làm lộ solution |
| “Giải bằng bất kỳ cơ chế phù hợp” | Editor tự do nhưng runtime chủ yếu hỗ trợ vehicle | 🟠 Không nên tuyên bố hỗ trợ mọi solution family |
| “Chỉ dùng Core Kit” | Palette giới hạn vào catalog hiện có | ✅ Đã có trong môi trường số |

## 5. Đối chiếu challenge setup

| Hạng mục BA | Giá trị BA | Hiện trạng repo | Mức đáp ứng |
|---|---:|---|---|
| Target user | 9–13 tuổi | UI tiếng Việt, wording hướng tới “kỹ sư nhí”; không có age gate trong challenge | 🟠 Một phần |
| Tổng thời gian | 45–60 phút | Không có session timer | ❌ Chưa có |
| Start → Goal | 50cm | Spawn và goal của Màn 2 cách nhau theo world unit | 🟡 Có khoảng cách mô phỏng; chưa quy đổi ra cm |
| Flood Zone | Rộng 20cm | Khoảng trống Màn 2 có kích thước world unit | 🟡 Có địa hình tương đương; chưa quy đổi ra cm |
| Supply Pod | Hộp 100g chuẩn | `core.supply-pod`, mass 0,1 kg | ✅ Đã có |
| Time limit/test | 60 giây | Evaluator đo elapsed time nhưng chưa hard-fail ở 60 giây | 🟠 Một phần |
| Vật liệu | Chỉ Core Kit | Part palette/catalog giới hạn | ✅ Đã có |
| Điểm điều khiển | Đứng sau Start Line | Điều khiển từ xa bằng bàn phím/D-pad | 🟡 Tương đương trong digital simulation |
| Human interaction | Kéo dây/quay tay/nhả cơ chế; không chạm pod | W/A/S/D điều khiển actuator | 🟡 Tương đương về nguyên tắc “điều khiển hệ thống, không kéo payload”; chưa có dây/tay quay |
| Số vòng bắt buộc | V1 và V2 | Có thể retry nhưng chưa bắt buộc và chưa lưu hai version | 🟠 Một phần |
| Variable change | V2 chỉ đổi một biến chính | Không có bước chọn/khóa biến | ❌ Chưa có |
| Component efficiency | Ghi số linh kiện | Có thể lấy từ `blueprint.parts.length` | 🟠 Dữ liệu sẵn có, chưa ghi vào result |

## 6. Đối chiếu điều kiện hoàn thành

| Điều kiện BA | Logic hiện tại | Khoảng trống |
|---|---|---|
| Supply Pod hoàn toàn trong Rescue Zone | Màn 2 đưa position của pod vào `RealtimeChallengeEvaluator` | Mới kiểm tra tâm pod; cần xét half-extents để đáp ứng chữ “hoàn toàn” |
| Supply Pod không chạm Flood Zone | Fail threshold hiện áp dụng trên position của pod | Đã bắt được pod rơi xuống vùng ngập; chưa lưu lịch sử contact với một trigger Flood Zone tường minh |
| Vật bên trong không rơi | Không mô phỏng vật bên trong | Có thể để thành checklist tự xác nhận trong physical test; 🚫 không cần mô phỏng cho MVP số |
| Trẻ không chạm Supply Pod | Không có camera/sensor quan sát trẻ | Có thể dùng checkbox cam kết hoặc self-report; không thể tự xác minh |
| Hoàn thành ≤60 giây | Có `elapsedSeconds` | Thêm hard timeout và result `timed-out` |
| Chỉ dùng linh kiện được cung cấp | Catalog giới hạn part | Đã đáp ứng trong simulator |

## 7. Đối chiếu các chỉ số V1/V2

| Chỉ số BA | Dữ liệu repo hiện có | Hiện đã lưu? | Việc tối thiểu cần làm |
|---|---|---:|---|
| Quãng đường hoàn thành | Root position và `distanceToGoal` | Không | Ghi max progress của Supply Pod vào attempt result |
| Thời gian hoàn thành | `elapsedSeconds`, `bestTimeSeconds` | Một phần | Lưu thời gian riêng cho V1 và V2, kể cả attempt thất bại |
| Pod rơi/nghiêng | Transform của mọi physics body có trong snapshot | Không | Xác định part đóng vai pod và tính tilt/contact state |
| Hệ thống gãy/kẹt/mất cân bằng | Physics diagnostics có một số failure kind | Một phần | Chuẩn hóa thành result reason của attempt |
| Số linh kiện | `blueprint.parts.length` | Không theo attempt | Snapshot số part lúc bắt đầu test |
| Số lần nhận hint | AI state có attempt/tier hiện tại | Một phần | Ghi hint events theo attempt thay vì chỉ tier cao nhất |
| Người lớn can thiệp | Không có | Không | Self-report tùy chọn; không tự suy đoán |

## 8. Đối chiếu userflow của Minh

| Bước BA | Những gì đã có | Những gì còn thiếu |
|---|---|---|
| 1. Nhận mission | Welcome modal, challenge modal, title/subtitle/tip | Mission briefing riêng, Flood/Start/Rescue labels, ba xác nhận của trẻ |
| 2. Lập kế hoạch | Không có form plan/prediction | Mechanism choice, câu giải thích, dự đoán pass/time/risk |
| 3. Build V1 | Palette, snap placement, rotate/delete, free building | Ẩn xe mẫu và bỏ solution-prescriptive copy trong challenge này |
| 4. Test V1 | Start/stop, physics, evaluator, timer, fail/victory | Theo dõi pod; lưu V1 result gồm distance/stability/flood contact |
| 5. Guided diagnosis | AI diagnostics, tutor 5 tầng | Hint đầu phải dựa trên payload observation, không nêu đáp án/component ngay |
| 6. Chọn một variable | Trẻ có thể thay bất kỳ part nào | UI ghi nhận một biến chính và lý do |
| 7. Build/Test V2 | Có thể quay về xưởng và retry | Snapshot V2 và bảng so sánh với V1 |
| 8. Reflection | Có AI widget | Câu hỏi reflection bắt buộc và câu trả lời được lưu |
| 9. Skill Report | Modal phụ huynh và evaluator | Report phải sử dụng test evidence thật, chỉ rõ trade-off thay vì generic praise |

## 9. Đối chiếu ví dụ kết quả V1 và V2

| BA mong muốn | Repo có thể lấy từ đâu | Hiện trạng |
|---|---|---|
| V1 reached Rescue Zone = No | Evaluator status | ✅ Có status tương đương, nhưng theo chassis |
| V1 distance = 32cm | Position/progress | 🟠 Có thể tính, chưa lưu và chưa có scale cm |
| V1 touched Flood Zone = Yes | Collision/zone history của pod | ❌ Chưa có |
| V1 stable = No | Rotation và diagnostics | 🟠 Có nguyên liệu dữ liệu |
| V1 completion time = 18s | `elapsedSeconds` | 🟠 Được tính nhưng attempt thất bại chưa thành record nghiệp vụ |
| Primary failure = dropped payload | Rules engine/AI diagnostics | ❌ Chưa có payload diagnosis |
| Variable = payload position | Part transform/connection thay đổi | 🟠 Có thể suy ra diff nhưng chưa có user-declared variable |
| V2 reached Rescue Zone = Yes | Evaluator status | 🟠 Phải đổi đối tượng đánh giá sang pod |
| V1 32cm → V2 50cm | Hai attempt records | ❌ Chưa có comparison model |
| V1 unstable → V2 stable | Hai attempt records | ❌ Chưa có comparison model |
| V2 chậm hơn 6 giây | Hai elapsed times | ❌ Chưa có trade-off generator |

## 10. Sự khác nhau quan trọng về “đã có”

### 10.1 UI đã có không đồng nghĩa dữ liệu đã có

Parent Report đang hiển thị attempt count, hint tier và autonomy score. `ParentInsightsEvaluator` tạo nhận xét từ challenge ID, số attempt và hint tier. Nó chưa nhận V1/V2 metrics, variable changed, payload stability hoặc adult intervention. Vì vậy trạng thái đúng là **🟠 Một phần**, không phải hoàn thành.

### 10.2 Goal Zone đã có nhưng target object chưa đúng

`RealtimeChallengeEvaluator` vẫn nhận một position mục tiêu. Với Màn 2, application truyền position của `supply-pod` thay vì root/chassis. Phần còn thiếu là xét kích thước collider để bảo đảm **toàn bộ** pod nằm trong Rescue Zone, không chỉ tâm pod.

### 10.3 Flood-like terrain đã có nhưng Flood Zone rule chưa có

Màn 2 có khoảng trống giữa hai bờ, phù hợp để kể lại thành vùng ngập. Tuy nhiên repo chưa có một trigger ghi nhận “pod đã từng chạm Flood Zone”. Việc xe/root rơi xuống thấp chỉ là một failure proxy.

### 10.4 Retry đã có nhưng controlled experimentation chưa có

Trẻ có thể test nhiều lần, nhưng controlled experimentation cần thêm ba bằng chứng:

1. Snapshot V1.
2. Một biến chính và lý do thay đổi.
3. Snapshot V2 cùng so sánh dựa trên dữ liệu.

## 11. Phạm vi challenge MVP phù hợp với repo

Để không thêm component mới, mapping đề xuất là:

| BA concept | MVP mapping |
|---|---|
| Challenge mới | Thay narrative và rules của Màn 2 `the-gap` |
| Supply Pod | Free body `core.supply-pod`, không xuất hiện trong palette |
| Base Camp | `environment.spawn` hiện có |
| Flood Zone | Khoảng trống giữa hai bờ của Màn 2 |
| Rescue Zone | `environment.goalZone` hiện có |
| Allowed solution | Mobile carrier/hybrid vehicle dùng part catalog hiện có |
| Version 1/2 | Hai attempt records có blueprint summary và metrics |
| One variable | Trẻ khai báo một biến chính trước V2 |
| Skill evidence | Diff đã khai báo + thay đổi performance thực tế |

Mapping này không tuyên bố simulator hỗ trợ cầu tĩnh, đường ray, dây, ròng rọc hoặc tời.

## 12. Wording challenge đề xuất

### Tên

**Tiếp tế qua vùng ngập**

### Bối cảnh

Sau trận mưa lớn, đường đến khu cứu hộ đã bị ngập. Người dân đang cần một hộp vật tư có bộ lọc nước.

### Nhiệm vụ

Hãy dùng các phụ tùng trong xưởng để chế tạo một phương tiện đưa Supply Pod từ Trạm xuất phát đến Khu cứu hộ. Supply Pod sẽ rơi xuống khi bài kiểm tra bắt đầu, vì vậy phương tiện cần đỡ và giữ hộp hàng trong suốt hành trình.

### Luật

- Đặt phương tiện bên dưới để đỡ Supply Pod khi bài kiểm tra bắt đầu.
- Sau khi bấm **Chơi**, con chỉ sử dụng các nút điều khiển.
- Supply Pod không được chạm vùng ngập.
- Supply Pod phải vào Khu cứu hộ trong tối đa 60 giây.

### Nguyên tắc hướng dẫn

Không hiển thị xe mẫu hoặc chỉ định phải dùng bánh, dầm, xích hay một cấu hình cụ thể. Hint đầu tiên phải hỏi trẻ quan sát điều gì đã xảy ra; chỉ các tầng sau mới thu hẹp vùng cần kiểm tra.

## 13. Bằng chứng trong repository

| Nội dung | File/symbol chính |
|---|---|
| Challenge contract | `src/challenge/domain/contracts.ts` — `ChallengeDefinition`, `ChallengeProgress` |
| Sáu challenge và Màn 2 | `src/challenge/domain/challenges-data.ts` — `STEM_CHALLENGES`, ID `the-gap` |
| Goal/time/fall evaluation | `src/challenge/domain/challenge-evaluator.ts` — `RealtimeChallengeEvaluator` |
| Blueprint, parts, connections, controls | `src/building/domain/contracts.ts` — `MachineBlueprint` |
| Game orchestration và progress | `src/app/sandbox-application.ts` |
| UI challenge/build/test | `src/app/ui/app-view.ts` |
| Physics body transforms | `src/adapters/rapier/rapier-physics-world.ts` — `snapshot()` |
| AI diagnosis | `src/ai/domain/physics-diagnostics.ts` |
| Hint tiers | `src/ai/domain/socratic-tutor.ts` |
| Parent report | `src/ai/domain/parent-insights-evaluator.ts` và `src/ai/ui/digital-to-physical-modal.ts` |
| Battery box candidate | `src/parts/battery-box/manifest.json` |
| Supply Pod physics/visual | `src/parts/supply-pod/manifest.json`, `visual.generated.ts`, `visual.adapter.ts` |

## 14. Kết luận traceability

Repository đã có nền tảng mạnh cho một challenge A→B: editor tự do, part catalog, physics, input, spawn, goal, terrain, timer, retry, diagnostics, hint UI và parent report UI.

Khoảng cách nghiệp vụ cốt lõi gồm ba điểm:

1. Kiểm tra toàn bộ kích thước Supply Pod nằm trong Rescue Zone và ghi nhận contact với Flood Zone.
2. Chuyển các lần retry thành bằng chứng **Version 1 → một biến → Version 2**.
3. Chuyển report/hint từ nội dung tổng quát sang nội dung dựa trên bằng chứng của payload và từng attempt.

Đây là mở rộng domain và data flow trên component hiện có, không yêu cầu sáng tạo thêm part cho MVP.
