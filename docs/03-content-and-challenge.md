# Plan 03 — Level content and Challenge

## Outcome

Load/validate/migrate bundled JSON thành immutable `LoadedLevel`, negotiate capability, và evaluate goal/timeout/reset bằng semantic events. Plan tự kiểm thử với fake fetch/event publisher, không cần renderer hay physics.

## Ownership

- `src/challenge/**`
- `src/adapters/storage/bundled-level-repository.ts`
- `public/content/**`
- Content/Challenge tests và fixtures

Không compile mesh/body và không sửa simulation loop.

## Subtasks

1. Hoàn thiện envelope schema cho `core.level`/`core.landscape`, numeric/security limits và namespaced polymorphic config.
2. Viết parsers explicit từ `unknown`; error chứa stable code + JSON path. Không `JSON.parse(...) as Type`.
3. Registry cho landscape object/objective/failure handler và capability negotiation required/optional.
4. Pure migration chain từng version; giữ original version/migration chain để log.
5. `BundledLevelRepository`: list, resolve URL tương đối an toàn, abort signal, atomic get và immutable output.
6. Cross-reference validation cho spawn, trigger, prefab capability và allowed part set trước compile.
7. Challenge evaluator state machine phát completion/failure đúng một lần cho enter-trigger, timeout và user reset.
8. Event descriptors/lifecycle: started, manifest loaded, optional skipped, validation failed, loaded, unloaded và result.

## Public contract

- Repository trả in-memory model không chứa Three/Rapier.
- Handler mới đăng ký qua registry, không sửa central switch.
- Invalid level không được trả partial result.

## Acceptance

- Fixture bundled hiện tại load thành công bằng test fetch adapter.
- Missing required capability fail; optional capability log rồi fallback.
- Migration fixture và malicious/out-of-range input có tests.
- Completion, timeout, reset đều idempotent và phân biệt semantic.
- `npm run check` pass.
