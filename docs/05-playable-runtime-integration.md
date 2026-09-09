# Plan 05 — Playable runtime integration

## Prerequisite

**Điều chỉnh ngày 2026-09-09:** phần sandbox physics/compiler/editor/input/visual lifecycle được triển khai sớm trong [Plan 04 mở rộng](./04-part-asset-pipeline-detailed-implementation.md), không phụ thuộc Plan 03. Prerequisite bên dưới áp dụng cho tích hợp Challenge đầy đủ. Khi thực hiện Plan 05, tái sử dụng runtime Plan 04 và chỉ hoàn thiện các hạng mục còn lại theo evidence handoff.

Chỉ bắt đầu sau khi plans 01–04 đã merge và `npm run check` pass. Đây là một plan tích hợp duy nhất; các bước dưới đây là subtask theo thứ tự vì cùng sở hữu lifecycle của `SimulationSession` và scene resources.

## Outcome

Một vertical slice hoàn chỉnh: load level → build/load fixture → compile → drive/steer → goal hoặc timeout → reset về blueprint, kèm HUD và event timeline.

## Ownership

- `src/simulation/**`
- `src/adapters/rapier/**`, `src/adapters/input/**`
- `src/adapters/three/**` trừ stable part visual adapter từ plan 04
- `src/app/**`, `src/main.ts`, `src/styles.css`
- `tests/e2e/**`

Các sửa đổi cần thiết ở module Wave A phải nhỏ, backward-compatible và có test ở module sở hữu.

## Ordered subtasks

1. **Physics adapter:** Rapier init một lần, thin `PhysicsWorld`, stable IDs/order, bodies/colliders/joints/sensors và deterministic headless tests.
2. **Compiler:** compile immutable Blueprint + LoadedLevel theo stable ordering; validate missing part/capability trước tạo world; rollback/dispose atomic khi lỗi.
3. **Session:** fixed accumulator 1/60, bounded catch-up, normalized controls, semantic intersections, transform snapshot và idempotent stop/dispose. Không ghi transform về blueprint.
4. **Three adapter:** scene/camera/renderer ownership, landscape prefab registry, build visuals, simulation frame sync, picking, orbit camera và collider/socket/joint debug overlays.
5. **Input:** keyboard mapping tiến/lùi/trái/phải, blur/visibility reset để tránh stuck key; UI không đọc per-frame physics state.
6. **Application state machine:** LoadingChallenge → Building → Compiling → Running → Completed/Failed → Building; mỗi transition/event/error có correlation.
7. **Build UI:** palette, add/remove/rotate/connect qua named socket, load fixture và command rejection feedback. Controller/View đều có `dispose()`.
8. **HUD/debug UI:** timer/result/reset và generic event timeline filter/export; unknown event render envelope + raw JSON.
9. **Verification:** headless simulation behavior, lifecycle leak tests, browser happy-path e2e và focused visual screenshots.

## Integration contracts

- Renderer chỉ tiêu thụ build state hoặc `SimulationFrame`; Three scene không là source of truth.
- Rapier handles chỉ sống trong session và không xuất hiện trong blueprint/event payload.
- Plan 04 đã nối telemetry runtime vào event bus chung: `input.control.changed/reset`, `simulation.controls.applied` và `physics.collision.started/stopped`; Plan 05 chỉ cần tái sử dụng timeline này khi bổ sung challenge semantics.
- Challenge kết luận result từ semantic simulation event, không từ raw Rapier callback.
- Reset dispose toàn bộ world/render/input resources rồi dựng lại đúng build pose.

## Acceptance

- Fixture car tiến/lùi/rẽ, tương tác ground/ramp/barrier và trigger goal.
- User có thể build chassis với ít nhất bốn wheel-related parts rồi simulate.
- Goal, timeout và manual reset có đúng state/result semantics.
- Repeated start/stop/reset không nhân listener, animation loop hoặc physics world.
- Event viewer thấy lifecycle, rejection, compile errors và result.
- `npm run check` và `npm run test:e2e` pass.
