# Plan 01 — Phương án triển khai chi tiết Event Log Foundation

Ngày khảo sát: **2026-09-08**.  
Trạng thái: **CLOSED** · Foundation đã được harden và xác minh ngày 2026-09-09; browser wiring vẫn là handoff Plan 05.  
Plan gốc: [01-event-log.md](./01-event-log.md).  
Baseline kiến trúc: [DECISIONS.md](../DECISIONS.md), đặc biệt mục 7, 14 và 15.  
Plan 02: **CLOSED**, không mở lại Building core trong phạm vi tài liệu này.

## 1. Mục tiêu và phạm vi

Hoàn thiện foundation gồm envelope factory, namespaced event bus, schema registry/upcaster, console sink, bounded memory ring buffer, query và JSON snapshot export. Toàn bộ logic phải kiểm chứng được bằng Vitest Node, không cần DOM, Three.js, Rapier hoặc implementation của domain khác.

Tài liệu này cụ thể hóa sáu subtasks trong Plan 01 thành mười task thực thi. Các API, tên file và policy đã được hiện thực trong codebase; acceptance và public contracts được giữ ổn định.

### 1.1 Vùng được sửa khi triển khai

- `src/kernel/events/**`
- `src/event-log/**`
- `src/adapters/event-log/**`
- Tests nằm cạnh các file trên.

Không sửa Building, Challenge, Simulation hoặc UI. Không thêm central union của tất cả event types, framework UI, backend, broker, persistent database hoặc replay engine.

### 1.2 Ranh giới với Plan 05

`src/app/composition-root.ts` hiện có TODO Plan 01 cho scaffold publisher, nhưng nằm ngoài ownership được ghi rõ trong Plan 01. Phương án này ưu tiên ownership: Plan 01 cung cấp implementation và handoff; Plan 05 thay scaffold, nối bus/sinks, inject shared sequence và dựng viewer.

Vì vậy, đóng Plan 01 có nghĩa foundation chạy xuyên suốt trong Node; không có nghĩa browser app đã hiển thị timeline. Không sửa app chỉ để làm demo trong phạm vi Plan 01.

## 2. Hiện trạng project đã khảo sát

| Khu vực | Hiện trạng | Tác động đến Plan 01 |
|---|---|---|
| Stack | TypeScript strict, Vite, Vitest Node, Three.js, Rapier | Có sẵn môi trường kiểm thử headless |
| Building core | Plan 02 CLOSED; aggregate, codec, application service, repository, fixture và tests đã có | Giữ nguyên behavior đã đóng |
| Event contracts | Có `EventEnvelope`, `EventPublisher` | Dùng tiếp boundary hiện tại |
| Envelope factory | Chưa có implementation dùng chung | Xây mới |
| Event bus | App dùng `ScaffoldEventPublisher`, publish bị bỏ qua | Xây bus thật trong vùng ownership |
| Descriptor | Có `parsePayload`, `summarize`, optional `redact` | Giữ interface, bổ sung registry/upcaster |
| EventLogService | Chỉ gọi lần lượt `sink.write(event)` | Thiếu validation, isolation và redaction |
| Console sink | Tất cả event qua `console.info()` | Cần severity routing và summary |
| Memory/query/export | Chưa có | Xây mới |
| Debug viewer | Controller còn TODO Plan 05 | Chỉ cung cấp API và lifecycle contract |
| Challenge/Simulation | Các implementation được khảo sát còn scaffold/TODO | Dùng fake/fixtures, không chờ chúng hoàn thiện |

### 2.1 File đã đọc làm căn cứ

- [Event contracts](../src/kernel/events/contracts.ts)
- [JSON contracts](../src/kernel/json.ts)
- [EventLogService](../src/event-log/application/event-log-service.ts)
- [EventDescriptor](../src/event-log/domain/event-descriptor.ts)
- [EventLogSink](../src/event-log/ports/event-log-sink.ts)
- [ConsoleEventLogSink](../src/adapters/event-log/console-event-log-sink.ts)
- [MachineBuildingService](../src/building/application/machine-building-service.ts)
- [Building application tests](../src/building/application/machine-building-service.test.ts)
- [Composition root](../src/app/composition-root.ts)
- [EventLogController](../src/app/debug/event-log-controller.ts)
- [Plan 02 closure](./02-building-core.md)
- [Plan 05 integration](./05-playable-runtime-integration.md)

### 2.2 Baseline verification

Đã chạy `npm run check` khi khảo sát ngày 2026-09-08:

- Typecheck: pass.
- ESLint: pass.
- Vitest: **7 test files, 31 tests pass**.
- Building dependency boundary: pass, 8 files, ES2023 không DOM.
- Production build: pass.

Đây là bằng chứng baseline trước implementation, không phải bằng chứng Plan 01 đã hoàn thành. Không thay đổi source trong quá trình khảo sát.

### 2.3 Tiến độ triển khai

- [x] Đợt 1 — contracts, JSON safety, immutable snapshots, envelope factory và sequence source.
- [x] Đợt 2 — namespaced bus, wildcard matching, stable ordering, unsubscribe và failure isolation.
- [x] Đợt 3 — schema registry, exact resolution, sequential upcast, unknown event projection và redaction pipeline.
- [x] Đợt 4 — console sink, bounded memory ring buffer, retention metadata, filters và JSON export.
- [x] Đợt 5 — public exports, Node integration tests, dependency cross-check, regression và handoff Plan 05.

Bằng chứng sau implementation: `npm run check` pass với **9 test files / 73 tests**; production build tạo được bundle; Building boundary và event-log foundation boundary đều pass (18 production files, bao gồm adapter event-log). Các test Plan 01 nằm ở [kernel event foundation tests](../src/kernel/events/event-log-foundation.test.ts) và [event-log foundation tests](../src/event-log/event-log-foundation.test.ts). Regression bổ sung bao phủ primitive severity (object/array/custom `toString` bị reject mà không gọi coercion), getter/clock/ID/sequence failure, metadata snapshot, JSON key đặc biệt, wildcard không hợp lệ, diagnostic re-entry/count/envelope kể cả qua queued bus với custom diagnostic type, sink diagnostics deferred theo thứ tự và nhiều sink lỗi, retention/listener lifecycle và producer Building thật dùng chung sequence.

## 3. Các quyết định triển khai đề xuất

### 3.1 Giữ public transport hiện tại

Giữ `publish(event: EventEnvelope): void` và `subscribe(pattern, handler): unsubscribe`. Thêm factory, registry và query theo hướng additive. Không bắt Building chuyển sang command/event format mới.

Bus không import registry hoặc descriptor nghiệp vụ. Bus kiểm tra envelope/JSON safety; schema-specific parsing, summary, redaction và upcast thuộc event-log layer.

### 3.2 Một sequence source cho một runtime

Building hiện có counter mặc định riêng nhưng đã hỗ trợ inject `sequence`, `id`, `now` qua `BuildingEventOptions`.

Phương án:

1. Tạo sequence source dùng chung trong `kernel/events`.
2. Factory và diagnostic events dùng source này.
3. Plan 05 inject cùng source vào Building qua options có sẵn.
4. Không đánh số lại envelope đã nhận hoặc lịch sử đã lưu.
5. Sequence tăng theo thứ tự tạo envelope; producer phải tạo rồi publish ngay để delivery order tương ứng.
6. Bus phát hiện sequence lùi/trùng thay vì âm thầm sửa; không yêu cầu liên tục vì có envelope được tạo nhưng không publish.
7. Khi dùng queue, kiểm tra thứ tự ở lúc tiếp nhận/enqueue, không chỉ lúc dispatch; diagnostics cũng đi qua cùng quy tắc.

Historical events dùng read/upcast APIs, không republish vào live bus như event mới. Sequence không phải business version và không thay thế optimistic version của Machine.

### 3.3 Phân biệt ba representation

| Representation | Vai trò | Policy |
|---|---|---|
| Business envelope trên bus | Vận chuyển event cho subscribers | Immutable snapshot, giữ payload nghiệp vụ |
| Stored log envelope | Lịch sử được giữ theo logging policy | Có thể đã redacted trước khi vào sinks; không bị rewrite bởi upcaster |
| Read projection | Summary và payload phiên bản consumer cần | Được tạo riêng, có status và migration chain |

“Raw history” trong tài liệu này nghĩa là bản đã được logging tiếp nhận, chưa upcast; không mặc định là bản chứa nguyên dữ liệu nhạy cảm trước redaction.

### 3.4 Failure policy

- Configuration errors như descriptor trùng hoặc subscription pattern sai: fail rõ lúc setup.
- Factory input không hợp lệ: trả typed result/error code.
- Invalid envelope đi trực tiếp vào `publish()`: không dispatch như event hợp lệ; báo diagnostic an toàn, giữ signature `void`.
- Subscriber/sink/parser/redactor failures lúc xử lý: isolate, có diagnostic, không làm command producer thất bại vì logging.
- Diagnostic handling thất bại: không sinh diagnostic vô hạn; dùng guard và counter lỗi bị chặn.

Điều này quan trọng vì Building có thể publish sau repository save. Sink throw ngược lên không được làm caller hiểu nhầm command thất bại dù dữ liệu đã lưu.

### 3.5 Unknown event và schema lỗi

- Unknown type/version vẫn được generic sink giữ và query/export.
- Descriptor được đăng ký nhưng payload parse thất bại là trạng thái khác với unknown; phải thể hiện error code/status.
- Missing upcast path không xóa hoặc rewrite record gốc.
- Không tự suy đoán schema hoặc đổi tên event cũ.

## 4. Cấu trúc file dự kiến

Các đường dẫn dưới đây là cấu trúc đã triển khai để chia trách nhiệm:

```text
src/kernel/events/
  contracts.ts                     # Giữ stable transport contracts
  event-errors.ts                  # Error data/code của infrastructure
  json-snapshot.ts                 # Validate, copy, freeze JSON-safe data
  event-envelope-factory.ts        # Factory, runtime sequence, tracing helpers
  diagnostic-reporter.ts           # Guard, counters và diagnostic envelopes
  namespaced-event-bus.ts          # Subscription, queue, delivery isolation
  index.ts                        # Public exports cần thiết
  *.test.ts

src/event-log/
  domain/
    event-descriptor.ts            # Interface hiện có
    event-schema-registry.ts       # Exact lookup và sequential upcast
    event-log-query.ts             # Filter contracts và matching
    event-presentation.ts          # Summary/generic projection
  application/
    event-log-service.ts           # Record pipeline và sink isolation
    event-log-export.ts            # Versioned JSON snapshot
  ports/
    event-log-sink.ts              # Giữ sink boundary
  index.ts
  **/*.test.ts

src/adapters/event-log/
  console-event-log-sink.ts
  memory-event-log-sink.ts
  *.test.ts
```

Không tạo layer/class riêng chỉ để chuyển tiếp một method. Có thể gộp helper nhỏ nếu vẫn giữ trách nhiệm rõ ràng. Không chuyển utility sang `kernel/json.ts` ngoài ownership chỉ vì tiện dùng chung.

## 5. Task 01 — Contracts bổ sung và fixtures

### Mục tiêu

Chốt API nhỏ, ổn định trước khi xây implementation phụ thuộc lẫn nhau.

### Subtasks sẽ thực hiện

1. Định nghĩa factory input: type, eventVersion, producer, payload, context, severity, timestamps/tracing options.
2. Định nghĩa injectable dependencies: UUID generator, clock và sequence source.
3. Định nghĩa event infrastructure error data với `code`, `path` và metadata JSON-safe tối thiểu.
4. Định nghĩa query filters, retention metadata và read projection status.
5. Định nghĩa migration result có source version, target version, chain và failure status.
6. Tạo fixtures có ID/clock/sequence xác định trước, không dùng thời gian thực trong assertion.
7. Tạo fake sink, fake console và recording handler cho tests.
8. Kiểm tra API mới không buộc thay `EventPublisher` hoặc Building options.

### Error codes đã dùng

- `event.envelope.invalid`
- `event.payload.not-json-safe`
- `event.id.invalid`
- `event.clock.invalid`
- `event.sequence.invalid`
- `event.subscription.invalid`
- `event.subscriber.failed`
- `event.schema.duplicate`
- `event.schema.invalid-payload`
- `event.upcast.failed`
- `event.sink.failed`
- `event.redaction.failed`
- `event.diagnostic.unconfigured`
- `event.diagnostic.invalid`

Phân biệt lỗi payload, context, timestamp, version qua `path`; không nhét object lỗi nguyên bản vào diagnostic.

### Hoàn thành khi

Contracts mới additive, fixtures dùng được hoàn toàn trong Node, không cần dựng app hoặc import implementation domain khác.

## 6. Task 02 — JSON safety và immutable snapshots

### Mục tiêu

Mọi envelope được chấp nhận serialize được mà không âm thầm mất hoặc đổi dữ liệu.

### Subtasks sẽ thực hiện

1. Viết runtime traversal, không chỉ dựa vào type `JsonValue`.
2. Chấp nhận string, boolean, null, finite number, dense array và plain JSON object.
3. Reject `NaN`, `Infinity`, `undefined`, function, symbol, bigint.
4. Reject cyclic references, sparse arrays, class instances, `Date`, `Map`, `Set`, `Error`.
5. Không gọi getter/accessor để lấy dữ liệu; reject accessor để tránh side effects.
6. Phân biệt object được tham chiếu nhiều lần với cycle thật bằng ancestor tracking.
7. Tạo copy do infrastructure sở hữu, không giữ reference mutable của caller.
8. Deep-freeze copy; không freeze object gốc của caller.
9. Validate cả payload và context, cùng JSON-bearing metadata nếu có.
10. Trả lỗi có JSON path chính xác, không serialize object bị reject để mô tả lỗi.
11. Bao lỗi traversal bất thường thành error an toàn; không để validator tự làm hỏng publish path.

Không dùng `JSON.stringify()` làm validator duy nhất: nó bỏ `undefined`, đổi số không hữu hạn thành `null` và có thể gọi `toJSON()`.

### Tests

- Nested payload/context hợp lệ.
- Từng loại input bị reject.
- Shared reference hợp lệ và cycle thật.
- Sparse array không bị normalize âm thầm.
- Caller sửa input sau publish không đổi history.
- Subscriber không mutate dữ liệu subscriber tiếp theo nhận.
- Getter không bị thực thi trong lúc validation.
- Error path đúng và diagnostic không chứa input hỏng.

### Dependencies và đầu ra

Phụ thuộc Task 01. Đầu ra là helper validate/copy/freeze dùng cho factory, bus và logging boundary.

## 7. Task 03 — Envelope factory và tracing helpers

### Subtasks sẽ thực hiện

1. Implement factory nhận ID generator, clock và sequence source.
2. Default ID dùng UUID; cho phép generator deterministic trong tests, không ép fixtures phải là UUID thật.
3. Tạo timestamps UTC hợp lệ; cho phép cung cấp `occurredAt` khi event xảy ra trước thời điểm ghi nhận.
4. Validate required strings, severity, positive integer version, valid sequence và timestamps.
5. Chấp nhận namespaced event type mở, không whitelist module.
6. Tạo helper bắt đầu correlation mới.
7. Tạo helper event hậu quả: giữ correlation, đặt causation bằng ID cha trực tiếp, tạo ID/sequence mới.
8. Kế thừa trace metadata theo policy rõ ràng; không tự sinh tracing span engine.
9. Dùng JSON snapshot helper để trả envelope immutable.
10. Trả typed failure cho input không hợp lệ; bảo đảm counter không overflow âm thầm.
11. Document producer phải tạo rồi publish ngay; không dùng live sequence cho historical import.

### Tests

- Command/result cùng correlation.
- A → B → C có causation đúng từng bước.
- Hai producer dùng chung sequence source không trùng.
- Clock đứng yên/lùi không làm sequence lùi.
- Payload/context/timestamp/version sai bị reject.
- Input của caller không bị mutate.
- Optional fields tuân thủ `exactOptionalPropertyTypes`, không xuất field có giá trị `undefined`.

### Hoàn thành khi

Producer mới có một cách tạo envelope nhất quán; Building có thể dùng cùng dependencies qua options đã có, không sửa Building core.

## 8. Task 04 — Namespaced bus và delivery ordering

### Subtasks sẽ thực hiện

1. Implement `EventPublisher` hiện tại.
2. Hỗ trợ exact type, namespace wildcard cuối pattern và global wildcard.
3. Quy định `level.*` khớp `level.loaded`, `level.load.started`, không khớp `levelish.loaded` hoặc bare `level`.
4. Reject wildcard giữa pattern hoặc pattern không hỗ trợ.
5. Giữ thứ tự đăng ký subscriptions.
6. Mỗi lần subscribe là một subscription độc lập, kể cả cùng handler.
7. Unsubscribe idempotent.
8. Chụp danh sách subscriber cho từng event: thay đổi danh sách có hiệu lực từ event tiếp theo; callback trong snapshot hiện tại vẫn theo policy đã chốt.
9. Dùng queue cho publish trong handler, giao xong A trước B được sinh khi xử lý A.
10. Validate/copy/freeze envelope tại ingress, kể cả envelope không tạo qua factory.
11. Validate sequence ở acceptance/enqueue, giữ nguyên envelope metadata.
12. Cung cấp teardown rõ nếu bus giữ lifecycle state; không tạo global singleton ngầm.

### Tests

- Exact/namespace/global matching và negative cases.
- Registration order và subscriptions độc lập.
- Unsubscribe nhiều lần; self-unsubscribe.
- Subscribe/unsubscribe trong callback.
- Reentrant publish: mọi subscriber thấy A trước B.
- Invalid envelope không dispatch như event hợp lệ.
- Sequence lùi/trùng bị phát hiện, gaps hợp lệ.

### Hoàn thành khi

Delivery semantics xác định, không bị thay đổi ngẫu nhiên do mutation subscription list hoặc nested publish.

## 9. Task 05 — Failure isolation và diagnostics

### Subtasks sẽ thực hiện

1. Catch lỗi từng subscriber, tiếp tục subscriber còn lại.
2. Diagnostic chứa code, event ID/type nguồn khi hợp lệ, subscription/sink identifier và correlation/causation thích hợp.
3. Không đưa raw `Error`, cyclic payload hoặc message chưa qua policy vào diagnostic.
4. Sink isolation tương tự subscriber isolation.
5. Dùng một cơ chế báo lỗi nội bộ có guard, không để service/bus republish lỗi qua lại vô hạn.
6. Diagnostic xử lý lỗi tiếp: chặn diagnostic thứ cấp và tăng counter an toàn.
7. Thêm giới hạn queue/chuỗi delivery để callback tự publish vô hạn không treo runtime; giới hạn có default rõ và test bằng giá trị nhỏ.
8. Diagnostics mới dùng shared sequence, enqueue theo thứ tự thực tế và giữ causation nguồn.
9. Giữ contract callback đồng bộ; không mở rộng thành async job scheduler.
10. Phân biệt configuration failure với runtime processing failure trong API/documentation.

### Tests

- Subscriber đầu throw, subscriber sau vẫn nhận event.
- Console sink throw, memory sink vẫn ghi.
- Diagnostic subscriber throw không recursion.
- Nhiều sink lỗi vẫn có giới hạn diagnostic rõ ràng.
- Diagnostic có code và tham chiếu nguồn, JSON-safe.
- Queue overflow/chuỗi publish vô hạn bị chặn theo policy.
- Producer không nhận exception do logging subscriber/sink gây ra.

### Hoàn thành khi

Observability failures không lan thành failure nghiệp vụ, đồng thời không bị nuốt hoàn toàn mà không có dấu vết.

Implementation dùng `EventDiagnosticReporter` chung cho bus và EventLogService. Reporter có recursion guard trong report và policy nhận diện event diagnostic qua type đã cấu hình hoặc tag `diagnostic`, nên guard vẫn hiệu lực khi event đi qua queue; counter suppression tích lũy đọc được, giới hạn `maxSuppressedDiagnostics` mặc định 100, và tùy chọn tạo/publish diagnostic envelope bằng cùng `EventEnvelopeFactory`; envelope giữ correlation của nguồn và dùng source event ID làm causation. EventLogService gom lỗi của toàn bộ sinks rồi mới phát diagnostics, bảo đảm event nguồn vào mọi sink trước khi diagnostic được ghi.

## 10. Task 06 — Registry và sequential upcasting

### Subtasks sẽ thực hiện

1. Implement map theo `(type, version)`.
2. Giữ `resolve(type, version)` là exact lookup, không tự fallback latest.
3. Reject duplicate descriptor ngay lúc registration.
4. Validate metadata và giữ registry không phụ thuộc concrete domains.
5. Tách lookup current version khỏi exact lookup.
6. Đăng ký upcaster từng bước `vN → vN+1`; reject cạnh trùng, downgrade, self-loop và version jump trong policy ban đầu.
7. Khi consumer yêu cầu projection: parse source, chạy từng bước, validate JSON safety/schema mỗi bước.
8. Trả source/target version, migration chain và status rõ ràng.
9. Missing descriptor/path, parser failure hoặc upcaster failure không thay history.
10. Unknown/newer version dùng generic representation thay vì cố parse bằng schema khác.
11. Isolate dữ liệu đưa vào parser/upcaster để extension lỗi không mutate raw history.
12. Không persist current projection đè lên event nguồn.

### Tests

- Duplicate registration và exact lookup.
- v1 → v2; v1 → v2 → v3.
- Thiếu intermediate step.
- Upcaster throw hoặc trả non-JSON-safe data.
- Source/target payload sai schema.
- Unknown type và version mới hơn registry.
- Nhiều lần upcast không sửa raw envelope.
- Thêm descriptor module mới không đổi bus/sinks.

### Hoàn thành khi

Schema evolution nằm ở read path; lịch sử không bị rewrite và lỗi migration có thể phân biệt với unknown event.

## 11. Task 07 — Logging pipeline, redaction và presentation

### Subtasks sẽ thực hiện

1. Validate snapshot tại `record()` vì service có thể được gọi trực tiếp, không chỉ qua bus.
2. Resolve descriptor đúng version nếu có.
3. Tạo representation riêng cho logging.
4. Redact trước khi ghi sinks, validate lại output redaction.
5. Write từng sink với isolation.
6. Tạo presentation helper cho summary/schema status.
7. Unknown event có generic summary dựa trên envelope/type.
8. Summary phải dựa trên dữ liệu đã redacted; nếu không thể summarize an toàn thì generic fallback.
9. Không mutate business event trên bus.
10. Nếu redaction lỗi, không fallback về payload nguyên bản; phát diagnostic an toàn và bỏ payload đó khỏi output.
11. Không coi `redact(payload)` đã che context. Context chỉ dùng identifiers; nhu cầu che context dùng policy riêng tại logging boundary.
12. Tránh lưu representation đã upcast thay cho version gốc.

### Tests

- Sensitive field không có trong memory, console summary, export.
- Redaction không mutate business event.
- Redactor throw/invalid output không lộ raw payload.
- Unknown event vẫn ghi generic.
- Parser/summarizer lỗi không phá pipeline.
- Một sink lỗi không chặn sink khác.
- `errorCode` của rejection vẫn giữ nguyên khi không thuộc trường cần redaction.

### Hoàn thành khi

Transport, stored log và presentation tách bạch; không có fallback làm lộ dữ liệu đã yêu cầu che.

## 12. Task 08 — Console, ring buffer và query

### 12.1 Console sink

1. Inject console-like writer, giữ default thuận tiện cho constructor hiện tại.
2. Route severity tới `debug`, `info`, `warn`, `error` tương ứng.
3. Prefix chứa type, sequence và correlation.
4. Dùng safe summary; unknown/schema failure dùng generic representation.
5. Không serialize lại payload không cần thiết qua nhiều tầng.

### 12.2 Memory ring buffer

1. Dùng fixed-size array, head index và size.
2. Insert/evict O(1), không `shift()` mỗi lần đầy.
3. Capacity phải là positive integer.
4. Evict event cũ nhất khi đầy.
5. Read snapshot theo thứ tự cũ → mới, không lộ backing array.
6. Metadata gồm capacity, retained count, evicted count và retained sequence range.
7. `clear()` xóa history nhưng không reset runtime sequence; quy định rõ reset retention counters theo vòng đời buffer.
8. Cung cấp change listener và idempotent unsubscribe cho viewer sau này.
9. Listener lỗi được isolate theo cùng nguyên tắc, không phá write path.

### 12.3 Query semantics

| Filter | Policy đề xuất |
|---|---|
| Namespace | Prefix có ranh giới dấu chấm |
| Severity | Membership trong tập được chọn |
| Tags | Có mode `any` hoặc `all` rõ ràng |
| Time | `observedAt`, từ/đến inclusive |
| Correlation ID | Exact match |
| After sequence | Cursor đơn giản |
| Limit | Áp dụng sau filtering, theo delivery order |

Các nhóm filter kết hợp bằng AND. Không sort theo `occurredAt` vì event đến trễ có thể đảo timeline. Validate invalid filter/range/limit rõ ràng. Document semantics của filter rỗng để UI không đoán.

### Tests

- Capacity 1, full buffer và nhiều vòng wrap-around.
- Eviction giữ đúng thứ tự.
- Từng filter, tổ hợp filters, timestamp boundaries.
- Namespace không match nhầm prefix.
- Snapshot không sửa được history.
- Clear/listener/unsubscribe và listener failure.
- Cursor cũ hơn retained range có metadata nhận biết history đã bị cắt.
- Console severity routing và generic summary.

### Hoàn thành khi

Viewer có API đủ để đọc/filter timeline mà không truy cập implementation buffer.

## 13. Task 09 — Versioned JSON export và raw physics policy

### Subtasks sẽ thực hiện

1. Export JSON string thuần; không DOM, Blob hoặc download button.
2. Snapshot có schema version riêng, exported timestamp, applied filters, retention metadata và events.
3. Chụp danh sách tại một thời điểm trước serialize.
4. Export stored representation mặc định; không tự nâng version toàn bộ history.
5. Giữ unknown events với envelope/payload hợp lệ.
6. Không export descriptor objects, functions hoặc internal buffer.
7. Giữ rejection `errorCode` và tracing metadata để tìm kiếm/debug.
8. Cung cấp retention exclusion policy dựa trên tag/metadata cho raw high-frequency records.
9. Test raw-tagged contacts không vào retained/exported log, semantic events vẫn giữ.
10. Handoff Plan 05: physics adapter phải lọc/aggregate contacts trước publish.

JSON validator không thể tự biết một number là Rapier handle hay business ID. Vì vậy raw physics policy cần contract từ producer; không tuyên bố chỉ JSON validation đã bảo đảm semantic safety. Không hard-code danh sách domain hiện tại vào generic logger.

### Tests

- JSON parse round-trip.
- ID/version/sequence/correlation giữ nguyên.
- Field redacted không xuất hiện.
- Unknown event được giữ.
- Export sau wrap-around có metadata đúng.
- Raw-contact exclusion và semantic event acceptance.
- Export không mutate history hoặc trigger upcast rewrite.

### Hoàn thành khi

Có snapshot debug ổn định, versioned và đủ context để phân tích lỗi ngoài runtime.

## 14. Task 10 — Exports, regression và handoff

### Subtasks sẽ thực hiện

1. Export public API qua `src/event-log/index.ts` và entry point `kernel/events`.
2. Giữ constructor hiện tại tương thích hoặc bổ sung options có defaults.
3. Không sửa root adapter barrel ngoài ownership; ghi import path cần dùng cho integration.
4. Viết integration test thuần Node: factory → bus → command/result/rejection → logging → memory/query → JSON export.
5. Dùng fixtures tương thích Building envelope thực tế: `machineId`, `errorCode`, correlation, causation, version 1.
6. Không import Building concrete implementation vào production event-log; integration fixtures không buộc sửa Building tests.
7. Kiểm tra dependency closure của production event-log/kernel không kéo DOM, Three.js, Rapier hoặc domain implementation khác vào; phân biệt với baseline checker vốn chỉ bảo vệ Building.
8. Chạy focused tests khi làm từng task; cuối cùng `npm run check`.
9. Ghi closure evidence thực tế sau implementation, không dùng số test dự kiến như kết quả đã chạy.
10. Bàn giao wiring và limitations cho Plan 05.

### Handoff cụ thể cho Plan 05

1. Tạo một runtime sequence source và injected clock/UUID dependencies.
2. Tạo real bus, registry, memory sink, console sink và EventLogService.
3. Đăng ký module-owned descriptors; event chưa có descriptor vẫn generic.
4. Subscribe log service vào `*` và giữ unsubscribe handle.
5. Inject cùng sequence source vào `MachineBuildingService` qua `BuildingEventOptions` hiện có.
6. Cho producer Challenge/Simulation dùng factory/shared source.
7. Thay `ScaffoldEventPublisher` trong composition root.
8. Mount viewer dựa trên query/change-listener/export APIs.
9. UI tạo thao tác download; foundation chỉ trả JSON snapshot.
10. Teardown unsubscribe/listeners khi dispose; reset simulation không mặc định reset toàn application event sequence.

### Hoàn thành khi

Foundation chạy xuyên suốt trong Node, baseline Building regression còn pass và integration còn lại được mô tả đủ cụ thể.

## 15. Thứ tự thực hiện và checkpoint

| Đợt | Tasks | Checkpoint |
|---|---|---|
| 1 | 01–03 | Contracts, immutable envelope, tracing và shared sequence |
| 2 | 04–05 | Bus ordering, unsubscribe, error isolation và recursion guard |
| 3 | 06–07 | Registry, upcast, redaction và safe presentation |
| 4 | 08–09 | Console, bounded memory, query và export |
| 5 | 10 | Public APIs, Node integration, regression, quality gate và handoff |

Tests đi cùng implementation từng task. Không đợi cuối mới kiểm tra reentrant delivery, mutation hoặc redaction failure. Đây là thứ tự công việc, không yêu cầu chạy nhiều agents hoặc sửa đồng thời các module.

## 16. Mapping về sáu subtasks của Plan gốc

| Subtask Plan 01 | Tasks chi tiết |
|---|---|
| Envelope factory, injectable UUID/clock, sequence, tracing, JSON safety | 01, 02, 03 |
| Exact/namespace/global subscription, safe unsubscribe | 04, 05 |
| Schema registry, exact version, sequential upcast, immutable raw | 06, 07 |
| Console sink, bounded ring buffer, filters | 07, 08 |
| JSON export, unknown event, không persist raw contacts | 07, 09 |
| Ordering/rejection/upcast/unknown/redaction/eviction tests | Tests trong 02–09 và integration ở 10 |

## 17. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý đã đưa vào plan |
|---|---|
| Building và producer khác tự tạo sequence riêng | Shared source; inject qua existing Building options trong Plan 05 |
| Envelope tạo trước nhưng publish muộn làm lùi timeline | Quy định create-and-publish, ingress ordering validation; không rewrite metadata |
| Sink throw sau repository save làm command bị hiểu là failed | Isolate subscriber/sink errors |
| Diagnostic tự gây diagnostic vô hạn | Guard, bounded delivery và suppressed-error counter |
| `readonly` TypeScript không bảo vệ runtime history | Copy + deep freeze tại boundary |
| Upcaster hoặc parser mutate input | Isolated input, separate projection, mutation tests |
| Summary/export làm lộ dữ liệu đã redacted | Redact trước sinks, summary trên safe representation, không raw fallback |
| Unknown event bị drop vì thiếu descriptor | Generic storage/read/export |
| Ring buffer tăng memory hoặc copy quá nhiều | Fixed capacity, O(1) insert/evict, snapshot khi đọc |
| JSON-safe payload vẫn chứa raw physics handles | Producer semantic policy và retention exclusion; không dựa vào shape validation đơn thuần |
| Làm lấn UI/composition vì muốn demo ngay | Handoff Plan 05, giữ ownership Plan 01 |

## 18. Điều kiện đóng Plan 01

- [x] Factory có injectable UUID, clock, runtime sequence source.
- [x] Envelope/payload/context được validate và immutable thực sự.
- [x] Correlation/causation helpers có tests.
- [x] Exact/namespace/global subscriptions, ordering và unsubscribe đạt policy.
- [x] Subscriber/sink failure không chặn consumer khác hoặc throw vào producer vì logging.
- [x] Diagnostic recursion và nested publish vô hạn được chặn có kiểm chứng.
- [x] Registry reject duplicate, resolve exact và upcast tuần tự.
- [x] Raw stored envelope không bị rewrite bởi read/upcast.
- [x] Unknown events được lưu, query và export generic.
- [x] Redaction không mutate business event, không leak qua summary/export.
- [x] Ring buffer bounded, eviction/filter/cursor metadata có tests.
- [x] JSON snapshot versioned, parse được và giữ tracing/error codes.
- [x] Raw physics retention policy được kiểm thử và producer obligation được handoff.
- [x] Production module không phụ thuộc DOM/Three.js/Rapier/concrete domains khác.
- [x] `npm run check` pass, bao gồm Building regression của Plan 02.
- [x] Handoff shared sequence, descriptors, composition wiring và UI lifecycle cho Plan 05 đầy đủ.

Ưu tiên triển khai đã được thực hiện theo thứ tự envelope ownership → delivery ordering → failure isolation → schema/logging/query/export. Các hardening regression đã được xử lý: severity chỉ nhận primitive hợp lệ (không coercion/giữ reference), snapshot/factory không chạy accessor, dependency failure trả typed error, wildcard chỉ nhận exact/namespace/global, diagnostic re-entry qua queue được chặn theo type/tag với counter quan sát được, và sink diagnostics được deferred để giữ thứ tự event nguồn → diagnostics. Diagnostic envelope dùng shared sequence/correlation/causation khi được cấu hình. Plan 02 vẫn giữ trạng thái CLOSED. Plan 01 foundation được xem là hoàn tất theo checklist trên; thay `ScaffoldEventPublisher`, đăng ký descriptors của Challenge/Simulation, mount viewer và UI download vẫn thuộc Plan 05 như handoff.
