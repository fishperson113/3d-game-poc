# Implementation plans

Các plan dưới đây được viết để một coding session có thể nhận **một file**, triển khai và kiểm thử mà không cần mở rộng phạm vi. Baseline ở repository root là contract chung; không plan nào được tự ý đổi contract chung để tiện cho implementation cục bộ.

## Cách chạy song song

| Wave | Plan có thể chạy đồng thời | Vùng sở hữu chính |
|---|---|---|
| A | 01, 02, 03, 04 | Event log; Building; Content/Challenge; Part assets |
| B | 05 | Simulation + runtime integration, sau khi merge Wave A |

Wave B là **một plan lớn có các subtask tuần tự** vì compiler, physics session, renderer và UI lifecycle cùng chia sẻ runtime ownership; tách chúng thành plan song song sẽ tạo contract giả hoặc gây sửa chồng chéo.

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
