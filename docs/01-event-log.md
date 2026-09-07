# Plan 01 — Event log foundation

## Outcome

Xây event bus namespaced, schema registry/upcaster, console sink, ring-buffer sink và API query cho debug viewer. Module chạy hoàn toàn trong Node tests, không phụ thuộc DOM, Three.js, Rapier hoặc các domain implementation khác.

## Ownership

- `src/kernel/events/**`
- `src/event-log/**`
- `src/adapters/event-log/**`
- Tests nằm cạnh các file trên

Không sửa Building, Challenge, Simulation hoặc UI. Các module khác chỉ cần contract `EventPublisher` đã có.

## Subtasks

1. Hoàn thiện event envelope factory: UUID injectable, clock injectable, sequence monotonic theo runtime, correlation/causation helpers và JSON-safe validation.
2. Implement subscription exact type, namespace wildcard (`level.*`) và global wildcard (`*`); unsubscribe phải idempotent và publish phải an toàn khi subscriber tự unsubscribe.
3. Implement `EventSchemaRegistry`: reject descriptor trùng `(type, version)`, resolve exact version, upcast tuần tự nhưng giữ raw envelope bất biến.
4. Implement console sink và bounded memory ring buffer với filter theo namespace, severity, tag, time và correlation ID.
5. Tạo export JSON snapshot; unknown event vẫn được giữ/render generic. Không persist raw physics contacts.
6. Unit tests cho ordering, wildcard, rejection/error payload, upcast, unknown event, redaction và ring-buffer eviction.

## Public contract

- Giữ transport mở: không tạo central union của toàn bộ event types.
- Module-specific descriptors ở module sở hữu event; registry chỉ biết interface chung.
- Sink nhận immutable `EventEnvelope` và không mutate lịch sử khi upcast.

## Acceptance

- Command/result có thể chia sẻ correlation ID và causation chain.
- Sequence tăng đơn điệu; subscriber lỗi không ngăn subscriber khác và tạo diagnostic an toàn, không recursion vô hạn.
- Payload cyclic/non-JSON-safe bị reject với error code tìm kiếm được.
- Tất cả tests chạy bằng Vitest Node; `npm run check` pass.
