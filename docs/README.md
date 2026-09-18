# Implementation plans

## BA traceability

- [Supply Pod challenge và hệ thống hiện tại](./06-ba-supply-pod-challenge-traceability.md): đối chiếu từng thuật ngữ, yêu cầu và userflow của BA với UI, domain model và runtime đang có; phân biệt rõ đã có, tương đương, một phần và chưa có.

**Điều chỉnh ngày 2026-09-09:** user chọn triển khai [Plan 04 mở rộng](./04-part-asset-pipeline-detailed-implementation.md) trước Plan 03, gồm asset pipeline và sandbox lắp ráp/lái xe với visual thay được. Plan 04 nhận phần runtime/editor cần thiết từ Plan 05; Challenge để sau. Bảng Wave bên dưới là baseline ban đầu, không phải prerequisite ngăn chặng sandbox này.

Các plan dưới đây được viết để một coding session có thể nhận **một file**, triển khai và kiểm thử mà không cần mở rộng phạm vi. Baseline ở repository root là contract chung; không plan nào được tự ý đổi contract chung để tiện cho implementation cục bộ.

## Cách chạy song song

| Wave | Plan có thể chạy đồng thời | Vùng sở hữu chính |
|---|---|---|
| A | 01, 02, 03, 04 | Event log; Building; Content/Challenge; Part assets |
| B | 05 | Simulation + runtime integration, sau khi merge Wave A |

Wave B là **một plan lớn có các subtask tuần tự** vì compiler, physics session, renderer và UI lifecycle cùng chia sẻ runtime ownership; tách chúng thành plan song song sẽ tạo contract giả hoặc gây sửa chồng chéo.

Plan 04 extended đã được triển khai theo thứ tự 7 checkpoint: sandbox palette assembly, Rapier driving, lifecycle/reset và A/B model replacement đều có code/e2e evidence. Plan 03 content/challenge vẫn để sau; strict img2threejs generation chưa được claim pass vì checkout thiếu git metadata và chưa có external reference artifact.

## Luật handoff chung

- Đọc `DECISIONS.md` và file plan được giao; không tự thêm multiplayer, ECS, backend hoặc UI framework.
- Chỉ sửa vùng sở hữu được ghi trong plan. Nếu cần thay shared contract, ghi đề xuất trong handoff thay vì âm thầm sửa.
- Dùng fake adapter ở test để plan không phụ thuộc implementation từ plan khác.
- Không đưa Three.js/Rapier/DOM vào domain.
- Mỗi plan hoàn tất bằng `npm run check`; plan 05 chạy thêm `npm run test:e2e`.
- Commit generated asset và provenance, nhưng không commit artifact tạm lớn trong `work/` nếu chưa được review.

## Contract baseline

- `src/kernel/`: JSON, events, state và fixed-step constants.
- `src/building/domain/contracts.ts`: blueprint DTO dùng qua context boundary.
- `src/challenge/domain/contracts.ts`: loaded content DTO.
- `src/*/ports/`: technology seams.
- `public/content/`: fixture content có version.

Các type hiện tại cố ý nhỏ. Mỗi plan có thể thêm type trong module mình sở hữu; chỉ export cross-boundary data cần thiết.
