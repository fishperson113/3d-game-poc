# Plan 04 — Part catalog and img2threejs asset pipeline

**Status: IMPLEMENTED for Plan 04 runtime acceptance.** Phạm vi được user mở rộng ngày 2026-09-09: thêm sandbox lắp ráp/lái xe bằng `npm run dev`, chưa làm Challenge. [Kế hoạch triển khai chi tiết](./04-part-asset-pipeline-detailed-implementation.md) là scope thực thi hiện tại, bao gồm phần ownership runtime lấy sớm từ Plan 05. Strict img2threejs authoring limitation và cách thay model được ghi ở [part-model-replacement.md](./part-model-replacement.md).

## Outcome

Ba part cốt lõi có manifest, authoritative sockets/colliders, generated visual boundary, isolated preview và validation tooling. Runtime build vẫn hoạt động khi checkout img2threejs không có mặt.

## Ownership

- `art-source/parts/**`
- `work/img2threejs/**` (chỉ evidence được review)
- `src/parts/**`
- `src/adapters/three/part-visual*`
- `scripts/validate-part.mjs` và part-preview entry/config
- `tools/img2threejs.lock.json`
- `.agents/skills/img2threejs/**` là local tooling checkout (gitignored), không phải source ownership để commit

Không quyết định gameplay physics tuning ngoài explicit defaults trong PartDefinition; không sửa Machine aggregate hay Simulation session.

## Subtasks

1. Chạy `npm run skill:install:img2threejs` và verify repo-local snapshot tại `.agents/skills/img2threejs` đúng SHA trong `.source-commit`; nếu remote pin không còn reproducible, dừng và báo limitation trước generation. Không cài vào `src/` hoặc yêu cầu global skill.
2. Tạo brief/reference có license/provenance cho structural block, powered wheel và steering hinge.
3. Chạy staged img2threejs strict-quality flow cho từng part; giữ generated factory riêng, đánh dấu generated và không sửa tay logic hình học nếu pipeline có source spec.
4. Viết stable `visual.adapter.ts`, normalize mét/Y-up/+Z/origin; factory không tạo scene/camera/light/loop/listener.
5. Author manifest schema v1, sockets và simplified colliders độc lập với visual hints.
6. Xây static PartCatalog adapter, reject manifest sai trước registration và phát `asset.part.loaded`/structured failure.
7. Hoàn thiện CLI validation và part preview: axes, grid, socket orientation, collider wireframe, metrics, dispose/remount.
8. Tests cho manifest, factory ownership/disposal, socket/collider tolerance và screenshot fixture.

## Public contract

- Domain chỉ thấy `PartDefinition`; generated files chỉ được import từ visual adapter.
- `visual.generated.ts` luôn commit; Python/skill checkout không nằm trong runtime/CI happy path.
- Provenance phải là SHA thật, không placeholder.

## Acceptance

- `npm run part:qa -- <part-id>` chạy đúng cho cả ba part và gọi validate + typecheck + part tests.
- Strict-quality pass hoặc limitation cụ thể được ghi cạnh asset và trong handoff.
- Preview mount → dispose → remount không throw/leak observable.
- `npm run check` pass.
