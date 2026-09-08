# Plan 02 — Machine Building core

**Status: CLOSED** · Verified 2026-09-08 with `npm run check`.

## Outcome

Hoàn thiện `Machine` aggregate, commands/application service, static catalog fake và fixture blueprint xe bốn bánh. Đây là functional core thuần TypeScript và không cần renderer/physics để chứng minh invariant.

## Ownership

- `src/building/**`
- `src/adapters/storage/**` chỉ cho in-memory machine repository
- `src/parts/**/definition.ts`, `sockets.ts`, `colliders.ts` chỉ khi cần type fixture; không làm visual
- Building tests

Không triển khai DOM picking, Three.js visual hoặc Rapier compilation.

## Subtasks

1. Định nghĩa typed IDs, transforms hữu hạn, named sockets, compatibility tags, connection policy, capabilities và control binding.
2. Implement aggregate commands: create, add, remove, move, rotate 90 độ, connect, disconnect, configure và bind control.
3. Enforce unique part ID, catalog existence, socket existence/compatibility, single-use socket, self-connection policy và mode guard.
4. Chọn và ghi rõ policy remove-part: PoC dùng cascade connections + bindings liên quan trong cùng atomic operation.
5. Xuất/import `MachineBlueprint` schema v1 không chứa runtime handles; round-trip semantic equality.
6. Application service tạo correlation ID, gọi aggregate/repository và publish command/domain/rejection events qua injected `EventPublisher`.
7. Tạo in-memory repository và fixture xe bốn bánh ổn định cho simulation tests tương lai.

## Public contract

- Blueprint là boundary duy nhất sang Simulation.
- `PartCatalog` cung cấp definitions/capabilities qua port, không để aggregate import concrete part modules.
- Domain trả typed result/error code; không throw cho command rejection dự kiến.

## Acceptance

- Toàn bộ invariant trong `DECISIONS.md` có unit test happy path và rejection path.
- Cùng command sequence cho cùng blueprint output ổn định.
- Test xác nhận domain dependency graph không có DOM/Three/Rapier.
- `npm run check` pass.

## Closure evidence

- Typed IDs, immutable blueprint snapshots, finite transforms, named sockets, compatibility tags, single-use occupancy, self-connection policy, joint validation và configuration schema đã được enforce trong aggregate/codec.
- Đủ commands `create`, `add`, `remove`, `move`, `rotate`, `connect`, `disconnect`, `configure`, `bind`; remove part dùng cascade connections + bindings.
- Blueprint schema v1 có parse/semantic validation/export round-trip, không chứa runtime handles.
- Application service có correlation/causation events, rejection tracing, optimistic version save, per-machine serialization queue và simulation snapshot lock.
- In-memory repository, static fixture catalog và fixture xe bốn bánh ổn định đã có tests.
- Regression tests xác nhận sparse transforms bị từ chối, socket IDs chứa `:` round-trip đúng, configuration defaults được kiểm tra type/range như input.
- Boundary check dùng TypeScript duyệt dependency graph gián tiếp, chỉ cho phép domain + kernel và compile với ES2023 không có DOM. Đã thử chèn vi phạm trong bộ nhớ: DOM global và dependency gián tiếp ngoài boundary đều bị từ chối.
- Quality gate cuối: 31 tests passed, boundary check, typecheck/lint/build đều pass qua `npm run check`.
