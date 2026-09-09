# Collider and model handoff guide

Tài liệu này dành cho dev thay model, chỉnh kích thước part hoặc tiếp tục phát triển hệ thống assembly. Mục tiêu là giữ visual, socket, collider và physics joint cùng một hệ tọa độ, tránh tình trạng model nhìn đúng nhưng collider lệch, bánh xuyên thân hoặc joint bị kéo căng.

## 1. Nguồn dữ liệu authoritative

Mỗi part có bốn lớp riêng:

| Lớp | File | Trách nhiệm |
|---|---|---|
| Visual brief | `art-source/parts/<part>/brief.md` | Hình dáng, tỷ lệ và provenance |
| Visual factory | `src/parts/<part>/visual.generated.ts` | Tạo Three.js mesh trong local part frame |
| Visual adapter | `src/parts/<part>/visual.adapter.ts` | Normalize model và quản lý dispose |
| Gameplay contract | `src/parts/<part>/manifest.json` | Socket, collider, mass, actuator, axis và limit |

Mesh không phải nguồn xác định physics. Runtime không tự sinh collider từ mesh. Collider đơn giản trong manifest là contract gameplay ổn định và phải được review riêng khi thay đổi.

Một thay đổi chỉ về hình ảnh không được sửa:

- part ID hoặc socket ID;
- local part-frame origin;
- socket position/rotation;
- collider position/rotation/kích thước;
- actuator axis, steering limit hoặc motor parameters;
- blueprint transform hay joint logic.

Nếu model mới không khớp contract hiện tại, normalize visual trong adapter hoặc sửa file nguồn của model. Không di chuyển socket để bù cho origin export sai.

## 2. Quy ước tọa độ

- Một unit bằng một mét.
- Trục Y hướng lên.
- Hướng tiến của xe là +Z.
- Wheel quay quanh local +X.
- Steering quay quanh local +Y.
- Transform physics được áp lên part root đúng một lần.
- Scale và axis correction của asset chỉ được áp vào visual child.

Trước khi export model, đặt guide hoặc locator tại mọi socket. Sau import, tâm guide phải trùng socket marker trong part preview ở cả ba góc nhìn front, side và top.

## 3. Contract của steering knuckle

`core.steering-hinge` dùng origin ở giữa kingpin và wheel hub:

| Thành phần | Local value |
|---|---:|
| Chassis mount / kingpin | `[-0.20, 0, 0]` |
| Wheel axle / hub | `[0.20, 0, 0]` |
| Steering axis | `[0, 1, 0]` |
| Wheel-spin axis | `[1, 0, 0]` |
| Steering limit | `[-0.40, 0.40] rad` |
| Kingpin-to-hub length | `0.40 m` |

Visual phải có một cấu trúc nhìn thấy được nối từ `mount` tới `axle`. Kingpin nằm đúng tại socket `mount`; axle stub xuyên qua socket `axle`. Không đặt toàn bộ visual quanh origin như một khối vuông vì bánh sẽ che cơ cấu lái.

Collider hiện gồm:

- một cuboid mỏng bao tay đòn;
- một cylinder đứng bao kingpin;
- không có collider riêng cho steering tab và chi tiết trang trí mảnh.

Các collider của hinge và part nối trực tiếp được phép chồng nhẹ tại joint. Wheel và chassis không nối trực tiếp nên không được xuyên nhau; tuyệt đối không tắt contact wheel/chassis để che lỗi hình học.

## 4. Steering sweep và clearance

Kiểm tra pose trung tính là chưa đủ. Khi bánh steer, radius của lốp tạo một swept volume rộng hơn bề dày bánh.

Với:

- `h`: nửa bề dày bánh;
- `r`: bán kính bánh;
- `θ`: góc lái lớn nhất;
- `c`: vị trí mép chassis;
- `L`: khoảng cách kingpin tới tâm hub;

mép trong bảo thủ của bánh có thể ước lượng bằng:

```text
innerEdge ≈ c + L·cos(θ) - h·cos(θ) - r·sin(θ)
```

`innerEdge` phải nằm ngoài mép chassis cộng thêm safety clearance. Sau phép tính vẫn phải chạy collision regression thật; công thức chỉ dùng để loại sớm thiết kế không khả thi.

Khi thay bánh rộng hơn, tăng radius hoặc tăng steering limit, cần review lại đồng thời:

1. vị trí chassis mount;
2. chiều dài knuckle;
3. collider chassis;
4. wheel collider;
5. steering limit;
6. khoảng cách ở cả hai chiều lái.

Không kéo bánh ra xa tùy ý. Nếu cần khoảng cách lớn để tránh thân, visual phải thể hiện phần cơ khí lấp khoảng cách đó như knuckle, hub carrier hoặc axle stub.

## 5. Nguyên tắc tạo collider

- Ưu tiên cuboid, cylinder và compound collider nhỏ, dễ đọc.
- Collider nên bám silhouette cơ khí chính, không bám bolt, bevel hoặc chi tiết trang trí.
- Tránh một collider lớn bao cả khoảng rỗng của fork hoặc wheel arch.
- Không dùng collider cực mỏng nếu part có thể di chuyển nhanh qua vật khác.
- Không để visual nhô quá xa khỏi collider nếu phần đó được kỳ vọng phải va chạm.
- Không tạo nhiều collider chồng nhau nếu chúng chỉ mô tả cùng một khối lượng.
- Mọi kích thước, rotation và position phải hữu hạn, theo mét và ở local part frame.
- Sau khi sửa collider phải kiểm tra lại mass distribution, contact stability và joint drift.

Overlap preflight dùng world-space bounding boxes và có tính bảo thủ với collider xoay. Nếu một model hợp lệ bị reject, trước tiên kiểm tra origin, socket và collider envelope. Không tăng tolerance hoặc miễn cả loại part chỉ để test qua.

## 6. Quy trình thay model an toàn

1. Ghi lại part ID, visual revision và gameplay revision hiện tại.
2. Mở `manifest.json`, đánh dấu origin, sockets, colliders và actuator axes trong DCC/tool tạo model.
3. Thay mesh nhưng giữ nguyên local part frame.
4. Normalize scale/up-axis trong visual adapter nếu cần.
5. Kiểm tra variant mới trong isolated part preview với socket/collider overlays.
6. Kiểm tra model trong Build mode trước khi chạy physics.
7. Quan sát neutral pose, full-left và full-right steering.
8. Chạy drive/reverse/steer, Reset và đổi variant A/B.
9. Chạy toàn bộ command QA bên dưới.
10. Chỉ tăng `visual.revision` nếu gameplay contract không đổi.

Nếu sockets hoặc collider phải đổi, đây là gameplay migration. Dev phải tăng part revision, cập nhật fixtures, chạy overlap/stress regression và ghi lý do thay đổi trong PR/handoff.

## 7. Kiểm thử bắt buộc

```text
npm run part:qa -- core.structural-block
npm run part:qa -- core.powered-wheel
npm run part:qa -- core.steering-hinge
npm run check
npm run test:e2e
```

Các tín hiệu pass quan trọng:

- manifest parser chấp nhận socket/collider mới;
- assembly anchor không lệch;
- compile không báo `simulation.compile.collider-overlap` hoặc `environment-overlap` cho fixture hợp lệ;
- cấu hình overlap sai bị reject trước khi Rapier world được tạo;
- không có `physics.collision.started` giữa chassis và bánh trước khi steer hết limit;
- pose luôn hữu hạn;
- joint-anchor drift dưới ngưỡng regression;
- blueprint và physics specification không đổi khi chỉ đổi visual A/B;
- sau Reset, physics worlds và input listeners trở về zero;
- renderer resource counts trở về baseline sau lifecycle test.

Không sửa hoặc xóa assertion để làm model mới pass. Nếu test fail, xác định đó là lỗi visual alignment, contract geometry, collision envelope hay physics tuning trước khi chọn cách sửa.

## 8. Browser QA cho dev nhận handoff

Trên `http://localhost:5173/`:

1. Load Scout buggy và quan sát từ front/top/side.
2. Xác nhận bánh sau gần thân nhưng không nằm trong mesh thân.
3. Xác nhận kingpin, knuckle arm và axle stub phía trước đều nhìn thấy.
4. Start, giữ W+D rồi W+A; quan sát bánh quay và steer đúng trục.
5. Kiểm tra lốp không xuyên thân ở hai steering limit.
6. Kéo camera ra ngoài viewport rồi thả; camera không được kẹt drag.
7. Reset, đổi steering variant A/B và lặp lại.
8. Kiểm tra Event viewer không xuất hiện runtime failure hoặc collision chassis/front-wheel.

Ảnh chụp đẹp không thay thế collision regression. Browser QA dùng để bắt sai visual hierarchy, pivot, scale và clipping mà test số học không thể hiện rõ.

## 9. Nội dung handoff bắt buộc trong PR

Dev bàn giao cần ghi:

- part và variant đã đổi;
- visual revision trước/sau;
- gameplay revision có đổi hay không;
- origin và scale của asset nguồn;
- sockets/colliders/axes có thay đổi hay không;
- khoảng clearance nhỏ nhất ở neutral và steering limit;
- command QA đã chạy và kết quả;
- ảnh front/top/side của Build mode;
- ảnh hoặc video ngắn khi steer hai phía;
- limitation còn lại và asset provenance/license;
- cách rollback về visual revision trước.

Nếu không đo được clearance hoặc chưa chạy steering-limit collision test, handoff phải ghi rõ là chưa nghiệm thu collider. Không mô tả thay đổi là “visual-only” khi đã sửa socket, collider, mass, joint hoặc actuator.

