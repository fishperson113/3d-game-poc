import type { MachineBlueprint } from "../../building/domain/contracts";
import type { EventEnvelope } from "../../kernel/events/contracts";
import type { RuntimeState } from "../../kernel/runtime-contract";
import type { ChallengeDefinition, ChallengeProgress } from "../../challenge";

export interface AppViewModel {
  readonly state: RuntimeState;
  readonly blueprint: MachineBlueprint;
  readonly selectedPartId?: string | undefined;
  readonly feedback?: { readonly tone: "good" | "bad" | "neutral"; readonly message: string } | undefined;
  readonly placement?: { readonly definitionId: string; readonly candidateIndex: number; readonly candidateCount: number; readonly valid: boolean } | undefined;
  readonly placementTarget?: { readonly targetPartId: string; readonly targetSocketId: string; readonly sourceSocketId: string } | undefined;
  readonly assemblyGuide: readonly string[];
  readonly samples: readonly { readonly id: string; readonly label: string; readonly description: string }[];
  readonly selectedSampleId: string;
  readonly visualVariants: Readonly<Record<string, string>>;
  readonly events: readonly EventEnvelope[];
  readonly eventFilter: string;
  readonly rendererReady: boolean;
  // Gamification fields
  readonly challenges: readonly ChallengeDefinition[];
  readonly currentChallengeId: string;
  readonly challengeProgress: Readonly<Record<string, ChallengeProgress>>;
  readonly gameMode: "campaign" | "creative";
  readonly victoryState?: { readonly stars: number; readonly timeSeconds: number; readonly message: string } | undefined;
  readonly failState?: { readonly message: string; readonly stemTip: string } | undefined;
  readonly soundMuted: boolean;
  readonly showWelcomeModal: boolean;
  readonly showChallengeModal: boolean;
  readonly showAdvancedPanel: boolean;
}

export const palette = [
  ["core.structural-block", "Khung Cơ Bản", "Khung xe tiêu chuẩn 6 điểm gắn", "swatch-structural-block"],
  ["core.heavy-beam", "Dầm Khung Dài 🏗️", "Khung dài vượt hố sâu The Gap", "swatch-heavy-beam"],
  ["core.powered-wheel", "Bánh Động Cơ 🏎️", "Bánh cao su dẫn động W/S", "swatch-powered-wheel"],
  ["core.crawler-track", "Băng Xích Xe Tăng 🚜", "Xích bám đường siêu đỉnh leo dốc", "swatch-crawler-track"],
  ["core.steering-hinge", "Khớp Bẻ Lái 🔄", "Khớp xoay điều hướng A/D", "swatch-steering-hinge"],
  ["core.motor-module", "Động Cơ Siêu Tốc ⚡", "Tăng lực kéo và gia tốc mạnh mẽ", "swatch-motor-module"],
  ["core.drive-gear", "Bánh Răng Trợ Lực ⚙️", "Bánh răng bám gờ leo tường", "swatch-drive-gear"],
  ["core.battery-box", "Hộp Pin Trọng Tâm 🔋", "Hạ trọng tâm, chống lật xe", "swatch-battery-box"],
] as const;

export class AppView {
  private readonly root: HTMLElement;

  public constructor(private readonly host: HTMLElement) {
    host.innerHTML = `
      <div class="sandbox-shell">
        <header class="topbar">
          <div class="brand-group">
            <button class="icon-button home-btn" data-action="open-welcome" title="Màn hình chính">🏠</button>
            <div>
              <p class="eyebrow">STEM CAR LAB · PHÒNG THÍ NGHIỆM CƠ KHÍ</p>
              <h1 class="game-title">Xưởng Chế Tạo Xe Thông Minh</h1>
            </div>
          </div>
          <div class="status-cluster">
            <button class="sound-toggle-btn" data-action="toggle-sound" title="Bật/Tắt Âm thanh">🔊</button>
            <div class="badge-tag level-badge" data-role="level-badge" data-action="open-challenges" title="Nhấp để đổi màn chơi">🎯 Màn 1: Trường Tập Lái</div>
            <div class="badge-tag star-badge" data-role="star-count">⭐ 0/18</div>
            <div class="badge-tag rank-badge" data-role="rank-badge">🔰 Kỹ Sư Nhí</div>
            <span class="status-dot"></span>
            <span data-role="runtime-state" class="state-text">Lắp ráp</span>
          </div>
        </header>

        <div class="toolbar" data-role="toolbar">
          <button data-action="start" class="btn-stem btn-start" title="Bắt đầu lái thử chiếc xe bạn vừa chế tạo!">🎮 Lái Thử</button>
          <button data-action="stop" class="btn-stem btn-stop" title="Dừng xe lại để tinh chỉnh tiếp">🛑 Về Xưởng</button>
          <button data-action="reset" class="btn-stem btn-reset" title="Đưa xe về vị trí xuất phát ban đầu">🔄 Làm Lại</button>
          <button data-action="retry" class="btn-stem btn-retry">🔁 Thử Lại</button>
          <div class="toolbar-divider"></div>
          <button data-action="open-challenges" class="btn-stem btn-challenges" title="Xem danh sách 6 màn chơi">🎯 Chọn Thử Thách</button>
          <label class="sample-picker" title="Chọn nhanh một chiếc xe lắp sẵn để trải nghiệm">
            <span>🚗 Xe mẫu:</span>
            <select data-role="sample-select" data-action="sample-select"></select>
          </label>
          <button data-action="sample" class="btn-stem btn-load-sample">Nạp xe</button>
          <button data-action="reset-camera" class="btn-stem" title="Đặt lại góc nhìn đẹp từ phía sau xe">🎥 Góc Nhìn Chuẩn</button>
          <button data-action="toggle-advanced" class="btn-stem btn-advanced" title="Mở bảng thông số chuyên sâu">⚙️ Nâng Cao</button>
          <span class="toolbar-hint">💡 Mẹo: Bấm chọn phụ tùng ➔ Nhấn <b>Xác nhận gắn</b>. Phím <kbd>R</kbd> để xoay, <kbd>Delete</kbd> để xóa.</span>
        </div>

        <div class="sandbox-grid">
          <!-- Bảng phụ tùng bên trái -->
          <aside class="panel left-panel">
            <div class="panel-heading">
              <span>🧩 Hộp Phụ Tùng STEM</span>
              <span class="micro" data-role="parts-count">8 món</span>
            </div>
            <div class="palette" data-role="palette"></div>

            <details class="assembly-guide" open>
              <summary>📋 Hướng Dẫn Chế Tạo Thông Minh</summary>
              <div data-role="assembly-guide"></div>
            </details>

            <div class="panel-heading inspector-heading">
              <span>🔍 Chi Tiết Khối Đang Chọn</span>
              <span class="micro" data-role="selection-label">Chưa chọn</span>
            </div>
            <div data-role="inspector" class="inspector empty">Nhấp chuột vào một bộ phận trên xe 3D để xem.</div>

            <div class="feedback" data-role="feedback" aria-live="polite">Sẵn sàng chế tạo xe!</div>
          </aside>

          <!-- Khung nhìn 3D chính -->
          <main class="viewport-panel">
            <div class="viewport" data-role="viewport"></div>

            <!-- Điều khiển hướng dẫn đặt khối -->
            <div class="viewport-overlay">
              <span class="mode-label" data-role="mode-label">CHẾ ĐỘ XƯỞNG LẮP RÁP</span>
              <span class="placement-label" data-role="placement-label">Sẵn sàng đặt khối khung xe.</span>
              <div class="placement-actions" data-role="placement-actions">
                <button data-action="previous-socket" title="Thử vị trí gắn khác">← Đổi điểm gắn</button>
                <button data-action="next-socket" title="Thử vị trí gắn kế tiếp">Đổi điểm gắn →</button>
                <button data-action="rotate-placement" title="Xoay khối 90 độ">Xoay 90° (<kbd>R</kbd>)</button>
                <button data-action="confirm-placement" class="btn-stem btn-confirm" title="Gắn cố định vào xe">✅ Xác nhận gắn</button>
                <button data-action="cancel-placement" title="Hủy bỏ">❌ Hủy</button>
              </div>
            </div>

            <!-- Bàn phím ảo lái xe trên màn hình (Touch Driving D-Pad) -->
            <div class="driving-dpad" data-role="driving-dpad">
              <div class="dpad-header">🕹️ BÀN PHÍM LÁI XE (W/A/S/D)</div>
              <button class="dpad-btn dpad-up" data-drive="forward" title="Tiến lên (W / ↑)">
                <span class="dpad-arrow">▲</span>
                <span class="dpad-label">TIẾN (W)</span>
              </button>
              <div class="dpad-middle">
                <button class="dpad-btn dpad-left" data-drive="left" title="Rẽ trái (A / ←)">
                  <span class="dpad-arrow">◄</span>
                  <span class="dpad-label">TRÁI (A)</span>
                </button>
                <div class="dpad-center">🚗</div>
                <button class="dpad-btn dpad-right" data-drive="right" title="Rẽ phải (D / →)">
                  <span class="dpad-arrow">►</span>
                  <span class="dpad-label">PHẢI (D)</span>
                </button>
              </div>
              <button class="dpad-btn dpad-down" data-drive="backward" title="Lùi lại (S / ↓)">
                <span class="dpad-arrow">▼</span>
                <span class="dpad-label">LÙI (S)</span>
              </button>
            </div>
          </main>

          <!-- Bảng nâng cao bên phải (có thể ẩn/hiện) -->
          <aside class="panel events-panel" data-role="advanced-panel">
            <div class="panel-heading">
              <span>⚙️ Bảng Chuyên Gia STEM</span>
              <button data-action="export" class="text-button">Xuất JSON</button>
            </div>
            <div class="panel-subheading">Kiểm thử Visual Model:</div>
            <div class="variant-controls" data-role="variants"></div>
            <div class="panel-subheading" style="margin-top: 1rem;">Nhật ký sự kiện thời gian thực:</div>
            <label class="event-filter">Lọc <input data-role="event-filter" placeholder="Tìm sự kiện... (input, physics)" /></label>
            <div data-role="events" class="events" aria-live="polite"></div>
          </aside>
        </div>

        <!-- MODAL 1: Màn hình chào mừng (Title / Welcome Screen) -->
        <div class="modal-backdrop welcome-modal" data-role="welcome-modal">
          <div class="modal-card welcome-card">
            <div class="robot-avatar">🤖</div>
            <h2>Chào Mừng Đến Với STEM Car Lab!</h2>
            <p class="robot-speech">
              "Xin chào Nhà Sáng Chế Nhí! Hành tinh STEM đang gặp nhiều địa hình hiểm trở. Hãy cùng Robot Rô-Bô thiết kế những cỗ xe kỳ diệu để vượt qua các vách núi, hố sâu và bậc thang nhé!"
            </p>
            <div class="welcome-features">
              <div class="feature-item"><span>🧩</span><b>Lắp Ráp Dễ Dàng</b><small>Ghép các khối khung, bánh xe, băng xích và động cơ.</small></div>
              <div class="feature-item"><span>🎮</span><b>Lái Thử Thời Gian Thực</b><small>Trải nghiệm vật lý 3D chân thực, vượt dốc và rãnh sâu.</small></div>
              <div class="feature-item"><span>🏆</span><b>6 Thử Thách Kỳ Thú</b><small>Khám phá cách xe dài vượt hố nứt và xe xích leo tường đứng.</small></div>
            </div>
            <div class="modal-actions">
              <button class="btn-stem btn-big btn-primary" data-action="close-welcome">BẮT ĐẦU CHẾ TẠO NGAY 🚀</button>
            </div>
          </div>
        </div>

        <!-- MODAL 2: Bản đồ chọn Màn Chơi (Level Map) -->
        <div class="modal-backdrop challenge-modal" data-role="challenge-modal" style="display: none;">
          <div class="modal-card challenge-card">
            <div class="modal-header">
              <h2>🎯 Bản Đồ Thử Thách Địa Hình</h2>
              <button class="close-btn" data-action="close-challenges">✕</button>
            </div>
            <p class="modal-desc">Chọn một màn chơi để bắt đầu nhiệm vụ khoa học của bạn:</p>
            <div class="challenges-grid" data-role="challenges-grid"></div>
          </div>
        </div>

        <!-- MODAL 3: Chúc mừng Chiến Thắng (Victory Modal) -->
        <div class="modal-backdrop victory-modal" data-role="victory-modal" style="display: none;">
          <div class="modal-card victory-card">
            <div class="victory-header">
              <span class="confetti-icon">🎉</span>
              <h2>CHIẾN THẮNG XUẤT SẮC!</h2>
            </div>
            <div class="victory-stars" data-role="victory-stars">⭐⭐⭐</div>
            <p class="victory-message" data-role="victory-message">Xe của bạn đã cán đích thành công!</p>
            <div class="victory-actions">
              <button class="btn-stem btn-big btn-success" data-action="next-level">MÀN KẾ TIẾP ➡️</button>
              <button class="btn-stem btn-big" data-action="close-victory">Ở Lại Xưởng 🛠️</button>
              <button class="btn-stem btn-big" data-action="retry">Chơi Lại 🔁</button>
            </div>
          </div>
        </div>

        <!-- MODAL 4: Thất Bại / Thử Lại (Try Again Modal) -->
        <div class="modal-backdrop fail-modal" data-role="fail-modal" style="display: none;">
          <div class="modal-card fail-card">
            <div class="fail-header">
              <span class="robot-avatar-small">🤖</span>
              <h2>Ối! Chưa Qua Được Rồi!</h2>
            </div>
            <p class="fail-message" data-role="fail-message">Xe bị lọt hố sâu hoặc lật nhào.</p>
            <div class="stem-tip-box">
              <strong>💡 Lời khuyên từ Robot Rô-Bô:</strong>
              <p data-role="fail-tip">Thử lắp thêm dầm khung dài để xe bắc cầu qua khe nứt nhé!</p>
            </div>
            <div class="fail-actions">
              <button class="btn-stem btn-big btn-primary" data-action="close-fail">VỀ XƯỞNG SỬA XE 🔧</button>
              <button class="btn-stem btn-big" data-action="retry">LÁI THỬ LẠI 🔁</button>
            </div>
          </div>
        </div>
      </div>`;

    const paletteHost = this.element("palette");
    paletteHost.innerHTML = palette.map(([id, label, description, swatch]) => {
      return `
        <button class="palette-card" data-action="palette" data-part-id="${id}" title="${description}">
          <span class="palette-swatch ${swatch}"></span>
          <div class="palette-info">
            <strong>${label}</strong>
            <small>${description}</small>
          </div>
          <span class="plus">＋</span>
        </button>`;
    }).join("");

    this.root = host.firstElementChild as HTMLElement;
  }

  public getElement(role: string): HTMLElement { return this.element(role); }

  public render(model: AppViewModel): void {
    this.root.dataset.runtimeState = model.state;
    this.element("runtime-state").textContent = model.state === "Building" ? "Lắp ráp" : model.state === "Running" ? "Đang lái" : model.state === "Failed" ? "Sự cố" : model.state;

    // Header updates
    const currentChallenge = model.challenges.find((c) => c.id === model.currentChallengeId);
    if (currentChallenge !== undefined) {
      this.element("level-badge").textContent = `🎯 Màn ${String(currentChallenge.number)}: ${currentChallenge.title}`;
    }

    const totalStars = Object.values(model.challengeProgress).reduce((sum, p) => sum + p.stars, 0);
    this.element("star-count").textContent = `⭐ ${String(totalStars)}/18`;
    this.element("rank-badge").textContent = totalStars >= 12 ? "👑 Bậc Thầy Cơ Khí" : totalStars >= 6 ? "🔧 Thợ Máy Tài Năng" : "🔰 Kỹ Sư Nhí";
    (this.root.querySelector("[data-action=toggle-sound]") as HTMLElement).textContent = model.soundMuted ? "🔇" : "🔊";

    // Inspector
    const selection = model.selectedPartId === undefined ? undefined : model.blueprint.parts.find((part) => String(part.id) === model.selectedPartId);
    this.element("selection-label").textContent = selection === undefined ? "Chưa chọn" : String(selection.id);
    const inspector = this.element("inspector");
    if (selection === undefined) {
      inspector.className = "inspector empty";
      inspector.textContent = "Nhấp chuột vào một bộ phận trên xe 3D để xem hoặc tháo module.";
    } else {
      inspector.className = "inspector";
      const partName = palette.find(([id]) => id === selection.definitionId)?.[1] ?? selection.definitionId;
      const config = Object.entries(selection.configuration ?? {}).map(([key, value]) => `<div class="inspector-row"><span>${key}</span><code>${JSON.stringify(value)}</code></div>`).join("");
      const links = model.blueprint.connections.filter((c) => String(c.a.partId) === String(selection.id) || String(c.b.partId) === String(selection.id)).map((c) => {
        const otherId = String(c.a.partId) === String(selection.id) ? String(c.b.partId) : String(c.a.partId);
        return `<div class="connection-row"><span>Gắn với: <b>${otherId}</b></span><button data-action="disconnect" data-connection-id="${String(c.id)}" title="Tháo rời khớp nối này">Tháo Khớp</button></div>`;
      }).join("");
      inspector.innerHTML = `
        <div class="part-id">${partName} <small style="color:var(--text-dim);font-size:11px;">(#${String(selection.id)})</small></div>
        <div class="inspector-row"><span>Vị trí:</span><code>${selection.transform.position.map((v) => v.toFixed(2)).join(" ")}</code></div>
        ${config || "<div class=inspector-note>Thông số mặc định</div>"}
        <div class="inspector-subheading">Khớp liên kết trên xe</div>
        ${links || "<div class=inspector-note>Khối độc lập</div>"}
        <div class="inspector-actions">
          <button data-action="rotate-selected" title="Xoay khối 90 độ">🔄 Xoay 90°</button>
          <button data-action="delete-selected" class="danger-button primary-delete-btn" title="Gỡ bỏ module này và phụ kiện khỏi xe">🗑️ Tháo Module Khỏi Xe</button>
        </div>`;
    }

    // Mode and Placement UI
    const modeLabel = this.element("mode-label");
    const placementLabel = this.element("placement-label");
    const placement = model.placement;
    const target = model.placementTarget;
    if (model.state === "Running") {
      modeLabel.textContent = "🎮 CHẾ ĐỘ LÁI THỬ (DRIVING)";
      placementLabel.textContent = "Đang lái xe! Dùng phím W / S (Tiến/Lùi), A / D (Trái/Phải) hoặc cụm nút TIẾN, LÙI, TRÁI, PHẢI bên phải màn hình.";
      this.element("placement-actions").style.display = "none";
    } else if (model.state === "Failed") {
      modeLabel.textContent = "⚠️ SỰ CỐ XE";
      placementLabel.textContent = "Xe gặp sự cố hoặc lật. Bấm 'Thử Lại' hoặc 'Về Xưởng' để căn chỉnh lại xe!";
      this.element("placement-actions").style.display = "none";
    } else {
      modeLabel.textContent = "🔧 CHẾ ĐỘ XƯỞNG LẮP RÁP";
      placementLabel.textContent = placement === undefined
        ? (model.blueprint.parts.length === 0 ? "Sẵn sàng đặt khối móng đầu tiên." : "Chọn linh kiện bên trái để gắn vào xe. Nhấn '🎮 Lái Thử' để bắt đầu lái!")
        : `${placement.definitionId} ➔ gắn vào ${target?.targetPartId ?? "target"}:${target?.targetSocketId ?? "socket"} (${String(placement.candidateIndex + 1)}/${String(placement.candidateCount)})`;
      this.element("placement-actions").style.display = placement === undefined ? "none" : "flex";
    }

    // Assembly guide
    const guide = this.element("assembly-guide");
    guide.innerHTML = model.assemblyGuide.map((line, index) => `<div class="guide-step"><b>${String(index + 1).padStart(2, "0")}</b><span>${line}</span></div>`).join("");

    // Samples
    const sampleSelect = this.element("sample-select") as HTMLSelectElement;
    sampleSelect.innerHTML = model.samples.map((sample) => `<option value="${sample.id}"${sample.id === model.selectedSampleId ? " selected" : ""}>${sample.label}</option>`).join("");
    sampleSelect.disabled = model.state !== "Building";

    // Feedback
    this.element("feedback").className = `feedback ${model.feedback?.tone ?? "neutral"}`;
    this.element("feedback").textContent = model.feedback?.message ?? "Sẵn sàng.";

    // Variants
    const variants = this.element("variants");
    variants.innerHTML = palette.map(([id, label]) => `<label><span>${label}</span><select data-action="variant" data-part-id="${id}"><option value="A"${model.visualVariants[id] === "A" ? " selected" : ""}>Kiểu A</option><option value="B"${model.visualVariants[id] === "B" ? " selected" : ""}>Kiểu B</option></select></label>`).join("");

    // Events
    this.renderEvents(model.events, model.eventFilter);

    // Button states
    this.root.querySelectorAll<HTMLButtonElement>("[data-action=start], [data-action=retry], [data-action=stop], [data-action=reset], [data-action=sample]").forEach((button) => {
      const action = button.dataset.action;
      button.disabled = (action === "start" || action === "sample")
        ? model.state !== "Building" || !model.rendererReady
        : action === "retry"
          ? model.state !== "Failed" || !model.rendererReady
          : action === "stop"
            ? model.state !== "Running"
            : action === "reset"
              ? model.state === "LoadingChallenge" || model.state === "Compiling"
              : false;
    });

    // Driving D-pad visibility
    const dpad = this.element("driving-dpad");
    dpad.style.display = model.state === "Running" ? "flex" : "none";

    // Advanced panel visibility
    const advPanel = this.element("advanced-panel");
    advPanel.style.display = model.showAdvancedPanel ? "block" : "none";

    // Modals
    this.element("welcome-modal").style.display = model.showWelcomeModal ? "flex" : "none";
    this.element("challenge-modal").style.display = model.showChallengeModal ? "flex" : "none";

    // Render Challenges Grid in modal
    if (model.showChallengeModal) {
      const grid = this.element("challenges-grid");
      grid.innerHTML = model.challenges.map((c) => {
        const prog = model.challengeProgress[c.id];
        const starsStr = prog?.stars ? "⭐".repeat(prog.stars) : "☆☆☆";
        const isCurrent = c.id === model.currentChallengeId;
        return `
          <div class="challenge-item ${isCurrent ? "active" : ""}" data-action="select-challenge" data-challenge-id="${c.id}">
            <div class="ch-icon">${c.icon}</div>
            <div class="ch-body">
              <div class="ch-title">Màn ${String(c.number)}: ${c.title}</div>
              <div class="ch-sub">${c.subtitle}</div>
              <div class="ch-tip">${c.stemTip}</div>
            </div>
            <div class="ch-stars">${starsStr}</div>
          </div>`;
      }).join("");
    }

    // Victory modal
    const victoryModal = this.element("victory-modal");
    if (model.victoryState !== undefined) {
      victoryModal.style.display = "flex";
      this.element("victory-stars").textContent = "⭐".repeat(model.victoryState.stars);
      this.element("victory-message").textContent = model.victoryState.message;
    } else {
      victoryModal.style.display = "none";
    }

    // Fail modal
    const failModal = this.element("fail-modal");
    if (model.failState !== undefined) {
      failModal.style.display = "flex";
      this.element("fail-message").textContent = model.failState.message;
      this.element("fail-tip").textContent = model.failState.stemTip;
    } else {
      failModal.style.display = "none";
    }
  }

  private element(role: string): HTMLElement {
    const result = this.host.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (result === null) throw new Error(`Missing app view role: ${role}`);
    return result;
  }

  public renderEvents(events: readonly EventEnvelope[], eventFilter: string): void {
    const filter = eventFilter.trim().toLowerCase();
    const filtered = filter.length === 0 ? events : events.filter((event) => event.type.toLowerCase().includes(filter) || JSON.stringify(event.payload).toLowerCase().includes(filter));
    const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    this.element("events").innerHTML = filtered.slice(-80).reverse().map((event) => `<article class="event-row ${event.severity}"><div><b>${escape(event.type)}</b><span>#${String(event.sequence)}</span></div><small>${escape(JSON.stringify(event.payload))}</small></article>`).join("") || `<div class="empty events-empty">Không có sự kiện phù hợp.</div>`;
  }
}
