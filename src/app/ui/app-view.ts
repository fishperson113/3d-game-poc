import type { MachineBlueprint } from "../../building/domain/contracts";
import type { EventEnvelope } from "../../kernel/events/contracts";
import type { RuntimeState } from "../../kernel/runtime-contract";
import type { ChallengeDefinition, ChallengeProgress } from "../../challenge";

export interface AppViewModel {
  readonly state: RuntimeState;
  readonly blueprint: MachineBlueprint;
  readonly selectedPartId?: string | undefined;
  readonly feedback?: { readonly tone: "good" | "bad" | "neutral"; readonly message: string } | undefined;
  readonly placement?: { readonly definitionId: string; readonly candidateIndex: number; readonly candidateCount: number; readonly valid: boolean; readonly reason?: string | undefined } | undefined;
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
  readonly challengeBriefing?: { readonly challenge: ChallengeDefinition; readonly showModal: boolean };
  readonly supplyMission?: {
    readonly stage: "briefing" | "plan" | "build-v1" | "review-v1" | "build-v2" | "reflection" | "report";
    readonly showModal: boolean;
    readonly attempts: readonly {
      readonly version: 1 | 2;
      readonly completed: boolean;
      readonly elapsedSeconds: number;
      readonly distanceCm: number;
      readonly stable: boolean;
      readonly touchedFlood: boolean;
      readonly partCount: number;
    }[];
    readonly variableChanged?: string;
    readonly reflection?: string;
    readonly adultHelp?: boolean;
    readonly highestHintTier: number;
  };
}

export const palette = [
  ["core.structural-block", "Khung xe", "Khung chính có 6 điểm gắn", "swatch-structural-block"],
  ["core.heavy-beam", "Dầm dài", "Giúp xe vượt hố", "swatch-heavy-beam"],
  ["core.powered-wheel", "Bánh xe", "Giúp xe chạy", "swatch-powered-wheel"],
  ["core.crawler-track", "Băng xích", "Giúp xe leo dốc", "swatch-crawler-track"],
  ["core.steering-hinge", "Khớp lái", "Giúp xe đổi hướng", "swatch-steering-hinge"],
  ["core.motor-module", "Động cơ", "Cho xe thêm sức mạnh", "swatch-motor-module"],
  ["core.drive-gear", "Bánh răng", "Giúp xe bám đường", "swatch-drive-gear"],
  ["core.battery-box", "Hộp pin", "Giúp xe cân bằng", "swatch-battery-box"],
] as const;

export class AppView {
  private readonly root: HTMLElement;

  public constructor(private readonly host: HTMLElement, playerName = "bạn") {
    host.innerHTML = `
      <div class="sandbox-shell">
        <header class="topbar">
          <div class="brand-group">
            <button class="icon-button home-btn" data-action="open-welcome" title="Màn hình chính">🏠</button>
            <div>
              <p class="eyebrow">XƯỞNG XE STEM</p>
              <h1 class="game-title">Xưởng xe của bé</h1>
              <p class="player-greeting">Chào <span data-role="player-name"></span> 👋</p>
            </div>
          </div>
          <div class="status-cluster">
            <div class="badge-tag star-badge" data-role="star-count">⭐ 0/18</div>
            <div class="badge-tag rank-badge" data-role="rank-badge">Kỹ sư nhí</div>
            <span class="status-dot"></span>
            <span data-role="runtime-state" class="state-text">Lắp ráp</span>
          </div>
        </header>

        <div class="toolbar" data-role="toolbar">
          <button data-action="open-challenges" class="level-chip" data-role="level-badge" title="Chọn màn chơi">🎯 Màn 1</button>
          <button data-action="open-supply-mission" class="mission-chip" data-role="mission-chip" style="display:none">📦 Nhiệm vụ</button>
          <div class="toolbar-spacer"></div>
          <button data-action="start" class="btn-stem btn-start context-action" title="Cho xe chạy">▶ Chơi</button>
          <button data-action="stop" class="btn-stem btn-stop context-action" title="Quay lại lắp xe">■ Dừng</button>
          <button data-action="retry" class="btn-stem btn-retry context-action">↻ Chơi lại</button>
          <details class="tools-menu">
            <summary aria-label="Mở thêm công cụ" title="Thêm công cụ">•••</summary>
            <div class="tools-popover">
              <p class="tools-title">Thêm công cụ</p>
              <button data-action="reset" class="btn-stem btn-reset" title="Đưa xe về vạch xuất phát">↻ Làm lại</button>
              <div class="sample-tools" data-role="sample-tools">
                <label class="sample-picker" title="Chọn một chiếc xe có sẵn">
                  <span>Xe có sẵn</span>
                  <select data-role="sample-select" data-action="sample-select"></select>
                </label>
                <button data-action="sample" class="btn-stem btn-load-sample" title="Dùng xe đã chọn">Dùng xe</button>
              </div>
              <button data-action="reset-camera" class="btn-stem" title="Đưa góc nhìn về vị trí ban đầu">🎥 Góc nhìn</button>
              <button class="sound-toggle-btn" data-action="toggle-sound" title="Bật hoặc tắt âm thanh">🔊</button>
              <button data-action="toggle-advanced" class="btn-stem btn-advanced" title="Dành cho người hướng dẫn">⚙️ Người lớn</button>
            </div>
          </details>
        </div>

        <div class="sandbox-grid">
          <!-- Bảng phụ tùng bên trái -->
          <aside class="panel left-panel">
            <div class="panel-heading">
              <span>🧩 Phụ tùng</span>
              <span class="micro" data-role="parts-count">8 món</span>
            </div>
            <div class="palette" data-role="palette"></div>

            <details class="assembly-guide">
              <summary>💡 Cách lắp</summary>
              <div data-role="assembly-guide"></div>
            </details>

            <div class="feedback" data-role="feedback" aria-live="polite">Sẵn sàng chế tạo xe!</div>
          </aside>

          <!-- Khung nhìn 3D chính -->
          <main class="viewport-panel">
            <div class="viewport" data-role="viewport"></div>

            <aside class="context-popover" data-role="context-popover" aria-live="polite" hidden>
              <div class="selection-popover-copy">
                <span data-role="context-kicker">Đang chọn</span>
                <strong data-role="selection-name">Khối</strong>
                <strong data-role="placement-label" hidden>Chọn vị trí</strong>
              </div>
              <div class="selection-actions" data-role="selection-actions">
                <button data-action="rotate-selected" class="selection-action" title="Xoay khối 90 độ">↻ Xoay</button>
                <button data-action="delete-selected" class="selection-delete" title="Gỡ khối khỏi xe">🗑 Gỡ khối</button>
                <button data-action="clear-selection" class="selection-close" aria-label="Bỏ chọn khối" title="Bỏ chọn">✕</button>
              </div>
              <div class="placement-actions" data-role="placement-actions" hidden>
                <button data-action="previous-socket" title="Đổi sang vị trí trước">← Đổi chỗ</button>
                <button data-action="next-socket" title="Đổi sang vị trí tiếp theo">Đổi chỗ →</button>
                <button data-action="rotate-placement" title="Xoay khối">↻ Xoay</button>
                <button data-action="confirm-placement" class="placement-confirm" title="Xác nhận gắn khối">✓ Xác nhận</button>
                <button data-action="cancel-placement" class="selection-close" aria-label="Bỏ khối đang đặt" title="Bỏ">✕</button>
              </div>
            </aside>

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
            <h2 data-role="welcome-title">Sẵn sàng lắp xe chưa?</h2>
            <p class="robot-speech">
              Chọn phụ tùng, lắp chiếc xe của riêng mình và cùng Rô-Bô vượt thử thách nhé!
            </p>
            <div class="welcome-features">
              <div class="feature-item"><span>🧩</span><b>Lắp xe</b><small>Chọn và ghép phụ tùng.</small></div>
              <div class="feature-item"><span>🎮</span><b>Lái xe</b><small>Chạy, rẽ và vượt dốc.</small></div>
              <div class="feature-item"><span>🏆</span><b>Nhận sao</b><small>Chinh phục 6 màn chơi.</small></div>
            </div>
            <div class="modal-actions">
              <button class="btn-stem btn-big btn-primary" data-action="close-welcome">Vào xưởng 🚀</button>
            </div>
          </div>
        </div>

        <!-- MODAL 2: Bản đồ chọn Màn Chơi (Level Map) -->
        <div class="modal-backdrop challenge-modal" data-role="challenge-modal" style="display: none;">
          <div class="modal-card challenge-card">
            <div class="modal-header">
              <h2>🎯 Chọn màn chơi</h2>
              <button class="close-btn" data-action="close-challenges">✕</button>
            </div>
            <p class="modal-desc">Mình chơi màn nào?</p>
            <div class="challenges-grid" data-role="challenges-grid"></div>
          </div>
        </div>

        <!-- MODAL 3: Chúc mừng Chiến Thắng (Victory Modal) -->
        <div class="modal-backdrop victory-modal" data-role="victory-modal" style="display: none;">
          <div class="modal-card victory-card">
            <div class="victory-header">
              <span class="confetti-icon">🎉</span>
              <h2>Giỏi quá!</h2>
            </div>
            <div class="victory-stars" data-role="victory-stars">⭐⭐⭐</div>
            <p class="victory-message" data-role="victory-message">Xe của bạn đã cán đích thành công!</p>
            <div class="victory-actions">
              <button class="btn-stem btn-big btn-success" data-action="next-level">Màn tiếp ➡️</button>
              <button class="btn-stem btn-big btn-primary" data-action="open-build-modal">Lắp xe thật 📦</button>
              <button class="btn-stem btn-big" data-action="close-victory">Về xưởng 🛠️</button>
              <button class="btn-stem btn-big" data-action="retry">Chơi lại 🔁</button>
            </div>
          </div>
        </div>

        <!-- MODAL 4: Thất Bại / Thử Lại (Try Again Modal) -->
        <div class="modal-backdrop fail-modal" data-role="fail-modal" style="display: none;">
          <div class="modal-card fail-card">
            <div class="fail-header">
              <span class="robot-avatar-small">🤖</span>
              <h2>Thử lại nhé!</h2>
            </div>
            <p class="fail-message" data-role="fail-message">Xe bị lọt hố sâu hoặc lật nhào.</p>
            <div class="stem-tip-box">
              <strong>💡 Rô-Bô gợi ý:</strong>
              <p data-role="fail-tip">Thử lắp thêm dầm khung dài để xe bắc cầu qua khe nứt nhé!</p>
            </div>
            <div class="fail-actions">
              <button class="btn-stem btn-big btn-primary" data-action="close-fail">Sửa xe 🔧</button>
              <button class="btn-stem btn-big" data-action="retry">Chơi lại 🔁</button>
            </div>
          </div>
        </div>

        <div class="modal-backdrop mission-modal" data-role="supply-mission-modal" style="display:none;">
          <section class="modal-card mission-card" aria-labelledby="mission-title">
            <button class="close-btn mission-close" data-action="close-supply-mission" aria-label="Đóng">✕</button>
            <div data-role="supply-mission-content"></div>
          </section>
        </div>

        <div class="modal-backdrop mission-modal" data-role="challenge-briefing-modal" style="display:none;">
          <section class="modal-card mission-card" aria-labelledby="challenge-briefing-title">
            <button class="close-btn mission-close" data-action="close-challenge-briefing" aria-label="Đóng">✕</button>
            <div data-role="challenge-briefing-content"></div>
          </section>
        </div>

        <!-- MODAL 5: Mobile Device Fallback Overlay -->
        <div class="mobile-fallback-overlay" data-role="mobile-fallback">
          <div class="mobile-fallback-card">
            <div class="mobile-badge-tag">🔬 KHUYÊN DÙNG MÀN HÌNH LỚN</div>
            <div class="mobile-fallback-avatar">💻 🏎️ 🤖</div>
            <h2>Trải Nghiệm Tốt Nhất Trên Máy Tính Hoặc iPad!</h2>
            <p class="mobile-fallback-desc">
              Để bé có thể quan sát mô hình 3D đa chiều, lắp ghép các khớp nối chính xác và đối chiếu trực tiếp với bộ kit linh kiện STEM ngoài đời thực, vui lòng mở ứng dụng trên <b>Laptop/PC</b> hoặc <b>Máy tính bảng (Tablet ngang)</b> nhé!
            </p>
            <div class="mobile-reasons-list">
              <div class="mobile-reason-item">
                <span class="reason-icon">🖥️</span>
                <div>
                  <strong>Màn hình rộng rãi</strong>
                  <p>Dễ dàng thao tác camera 3D, chọn cổng nối và lái xe mượt mà.</p>
                </div>
              </div>
              <div class="mobile-reason-item">
                <span class="reason-icon">🛠️</span>
                <div>
                  <strong>Cầu nối lắp ráp thật</strong>
                  <p>Đặt màn hình cạnh khay linh kiện để đối chiếu từng bước lắp ráp ngoài đời.</p>
                </div>
              </div>
              <div class="mobile-reason-item">
                <span class="reason-icon">🧠</span>
                <div>
                  <strong>Trợ giảng AI Socratic</strong>
                  <p>Đồng hành, gợi ý tư duy khoa học và báo cáo năng lực cho phụ huynh.</p>
                </div>
              </div>
            </div>
            <div class="mobile-fallback-actions">
              <button class="btn-stem btn-primary btn-mobile-action" data-action="mobile-open-parent-sample">
                📊 Xem Thử Báo Cáo Phụ Huynh
              </button>
              <button class="btn-stem btn-secondary btn-mobile-dismiss" data-action="dismiss-mobile-fallback">
                👁️ Vẫn tiếp tục xem trên điện thoại
              </button>
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
    const safePlayerName = playerName.trim() || "bạn";
    this.element("player-name").textContent = safePlayerName;
    this.element("welcome-title").textContent = `Chào ${safePlayerName}! Sẵn sàng lắp xe chưa?`;
  }

  public getElement(role: string): HTMLElement { return this.element(role); }

  public render(model: AppViewModel): void {
    this.root.dataset.runtimeState = model.state;
    this.element("runtime-state").textContent = model.state === "Building" ? "Lắp xe" : model.state === "Running" ? "Đang chơi" : model.state === "Failed" ? "Thử lại nhé" : model.state;

    // Header updates
    const currentChallenge = model.challenges.find((c) => c.id === model.currentChallengeId);
    if (currentChallenge !== undefined) {
      this.element("level-badge").textContent = `🎯 Màn ${String(currentChallenge.number)}`;
      this.element("level-badge").setAttribute("title", currentChallenge.title);
    }

    const totalStars = Object.values(model.challengeProgress).reduce((sum, p) => sum + p.stars, 0);
    this.element("star-count").textContent = `⭐ ${String(totalStars)}/18`;
    this.element("rank-badge").textContent = totalStars >= 12 ? "👑 Cao thủ" : totalStars >= 6 ? "🔧 Khéo tay" : "🔰 Kỹ sư nhí";
    (this.root.querySelector("[data-action=toggle-sound]") as HTMLElement).textContent = model.soundMuted ? "🔇" : "🔊";

    // One contextual dialog handles both unconfirmed placement and installed parts.
    const selection = model.selectedPartId === undefined ? undefined : model.blueprint.parts.find((part) => String(part.id) === model.selectedPartId);
    const contextPopover = this.element("context-popover");
    const selectionActions = this.element("selection-actions");
    const placementActions = this.element("placement-actions");
    const placementLabel = this.element("placement-label");
    const placement = model.placement;
    const showContext = model.state === "Building" && (placement !== undefined || selection !== undefined);
    contextPopover.hidden = !showContext;
    contextPopover.classList.toggle("is-visible", showContext);
    contextPopover.classList.toggle("is-placement", placement !== undefined);
    if (placement !== undefined) {
      this.element("context-kicker").textContent = placement.valid ? "Sẵn sàng gắn" : "Chọn chỗ khác";
      this.element("selection-name").hidden = true;
      placementLabel.hidden = false;
      selectionActions.hidden = true;
      placementActions.hidden = false;
      const countStr = `${String(placement.candidateIndex + 1)}/${String(placement.candidateCount)}`;
      const partName = palette.find(([id]) => id === placement.definitionId)?.[1] ?? placement.definitionId.replace(/^core\./, "");
      placementLabel.textContent = placement.valid ? `${partName} · vị trí ${countStr}` : `Chưa gắn được · vị trí ${countStr}`;
      const confirmBtn = this.root.querySelector<HTMLButtonElement>("[data-action=confirm-placement]");
      if (confirmBtn) {
        confirmBtn.disabled = !placement.valid;
        if (!placement.valid) {
          confirmBtn.title = placement.reason ?? "Vị trí hoặc hướng không hợp lệ";
        } else {
          confirmBtn.title = "Gắn cố định vào xe";
        }
      }
    } else {
      this.element("context-kicker").textContent = "Đang chọn";
      this.element("selection-name").hidden = false;
      placementLabel.hidden = true;
      selectionActions.hidden = false;
      placementActions.hidden = true;
      if (selection !== undefined) this.element("selection-name").textContent = palette.find(([id]) => id === selection.definitionId)?.[1] ?? selection.definitionId;
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

    this.renderSupplyMission(model.supplyMission);
    this.renderChallengeBriefing(model.challengeBriefing, model.supplyMission !== undefined);

    // Render Challenges Grid in modal
    if (model.showChallengeModal) {
      const grid = this.element("challenges-grid");
      grid.innerHTML = model.challenges.map((c) => {
        const prog = model.challengeProgress[c.id];
        const isCompleted = (prog?.stars ?? 0) > 0 || prog?.completed === true;
        const starsStr = prog?.stars ? "⭐".repeat(prog.stars) : "☆☆☆";
        const isCurrent = c.id === model.currentChallengeId;
        return `
          <div class="challenge-item ${isCurrent ? "active" : ""} ${isCompleted ? "completed" : ""}">
            <div class="ch-main-row" data-action="select-challenge" data-challenge-id="${c.id}">
              <div class="ch-icon">${c.icon}</div>
              <div class="ch-body">
                <div class="ch-title-row">
                  <span class="ch-title">Màn ${String(c.number)}: ${c.title}</span>
                  ${isCurrent ? '<span class="ch-current-badge">Đang chọn</span>' : ""}
                </div>
                <div class="ch-sub">${c.subtitle}</div>
                <div class="ch-tip">${c.description}</div>
              </div>
              <div class="ch-stars">${starsStr}</div>
            </div>
            <div class="ch-footer-row">
              <button class="btn-stem btn-stem-sm btn-play-challenge" data-action="select-challenge" data-challenge-id="${c.id}">
                ${isCurrent ? "✓ Đang Chơi" : "🎮 Chọn Màn Này"}
              </button>
              ${
                isCompleted
                  ? `
                <div class="ch-extra-actions">
                  <button class="btn-stem btn-stem-sm btn-build-action" data-action="open-challenge-build" data-challenge-id="${c.id}" title="Xem Cẩm Nang Lắp Ráp Ra Đời Thật cho màn này">
                    📦 Lắp Ráp Thật
                  </button>
                  <button class="btn-stem btn-stem-sm btn-parent-action" data-action="open-challenge-parent" data-challenge-id="${c.id}" title="Báo Cáo Năng Lực Dành Cho Phụ Huynh">
                    👨‍👩‍👧 Báo Cáo
                  </button>
                </div>
              `
                  : `
                <span class="ch-locked-tag" title="Vượt qua thử thách này để mở khóa Cẩm nang lắp ráp & Báo cáo phụ huynh">
                  🔒 Hoàn thành để mở khóa cẩm nang
                </span>
              `
              }
            </div>
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

  private renderSupplyMission(mission: AppViewModel["supplyMission"]): void {
    const chip = this.element("mission-chip");
    const modal = this.element("supply-mission-modal");
    const sampleTools = this.element("sample-tools");
    if (mission === undefined) {
      modal.style.display = "none";
      sampleTools.style.display = "grid";
      return;
    }
    chip.style.display = "inline-flex";
    sampleTools.style.display = "none";
    const labels: Record<typeof mission.stage, string> = {
      briefing: "Nhận nhiệm vụ",
      plan: "Lập kế hoạch",
      "build-v1": "Version 1",
      "review-v1": "Xem V1",
      "build-v2": "Version 2",
      reflection: "Nhìn lại",
      report: "Hoàn thành",
    };
    chip.textContent = `📦 ${labels[mission.stage]}`;
    modal.style.display = mission.showModal ? "flex" : "none";
    if (!mission.showModal) return;
    const content = this.element("supply-mission-content");
    if (mission.stage === "briefing") {
      content.innerHTML = `
        <p class="mission-kicker">NHIỆM VỤ CỨU HỘ</p>
        <h2 id="mission-title">Tiếp tế qua vùng ngập</h2>
        <p class="mission-lead">Đưa hộp vật tư 100g từ Trạm xuất phát đến Khu cứu hộ.</p>
        <div class="mission-scene" aria-label="Lộ trình nhiệm vụ"><span>🏕️ Trạm xuất phát</span><b>≈ 50cm</b><span>🏥 Khu cứu hộ</span></div>
        <ul class="mission-rules">
          <li>📦 Đỡ và giữ Supply Pod trên xe.</li>
          <li>🌊 Không để hộp chạm vùng ngập.</li>
          <li>⏱️ Hoàn thành trong 60 giây.</li>
        </ul>
        <label class="mission-check"><input type="checkbox" data-role="mission-understood" /> Con đã hiểu luật và sẽ kiểm tra sản phẩm trước khi trả lời Rô-Bô.</label>
        <p class="mission-error" data-role="mission-error" aria-live="polite"></p>
        <button class="btn-stem btn-primary mission-primary" data-action="accept-supply-mission">Con hiểu rồi</button>`;
    } else if (mission.stage === "plan") {
      content.innerHTML = `
        <p class="mission-kicker">BƯỚC 1 · NGHĨ TRƯỚC KHI LẮP</p>
        <h2 id="mission-title">Kế hoạch của con</h2>
        <label class="mission-field">Con định làm một hệ thống như thế nào?<textarea data-role="mission-plan" maxlength="180" placeholder="Ví dụ: Con sẽ làm một chiếc xe có chỗ đỡ hộp..."></textarea></label>
        <div class="mission-fields-row">
          <label class="mission-field">Dự đoán thời gian<select data-role="mission-prediction"><option value="20">Khoảng 20 giây</option><option value="30" selected>Khoảng 30 giây</option><option value="45">Khoảng 45 giây</option><option value="60">Khoảng 60 giây</option></select></label>
          <label class="mission-field">Điều dễ gặp nhất<select data-role="mission-risk"><option value="drop">Hộp có thể rơi</option><option value="flood">Hộp có thể chạm nước</option><option value="stuck">Xe có thể mắc kẹt</option><option value="time">Xe có thể đi chậm</option></select></label>
        </div>
        <p class="mission-error" data-role="mission-error" aria-live="polite"></p>
        <button class="btn-stem btn-primary mission-primary" data-action="save-supply-plan">Bắt đầu lắp</button>`;
    } else if (mission.stage === "build-v1" || mission.stage === "build-v2") {
      const version = mission.stage === "build-v1" ? 1 : 2;
      content.innerHTML = `
        <p class="mission-kicker">VERSION ${String(version)}</p>
        <h2 id="mission-title">${version === 1 ? "Lắp ý tưởng đầu tiên" : "Chỉ đổi một điều"}</h2>
        <p class="mission-lead">${version === 1 ? "Khi sẵn sàng, đặt xe dưới Supply Pod rồi bấm Chơi." : `Biến đang kiểm tra: <strong>${this.escapeHtml(mission.variableChanged ?? "một thay đổi")}</strong>. Sửa xe rồi test lại.`}</p>
        <button class="btn-stem btn-primary mission-primary" data-action="close-supply-mission">Về xưởng</button>`;
    } else if (mission.stage === "review-v1") {
      const first = mission.attempts[0];
      content.innerHTML = `
        <p class="mission-kicker">VERSION 1 · KẾT QUẢ</p>
        <h2 id="mission-title">Mình đã có bằng chứng</h2>
        ${this.attemptSummary(first)}
        <label class="mission-field">Version 2 sẽ đổi một điều gì?<select data-role="mission-variable"><option value="Vị trí đỡ Supply Pod">Vị trí đỡ Supply Pod</option><option value="Chiều rộng khung xe">Chiều rộng khung xe</option><option value="Chiều dài khung xe">Chiều dài khung xe</option><option value="Số bánh xe">Số bánh xe</option><option value="Loại bánh hoặc băng xích">Loại bánh hoặc băng xích</option><option value="Vị trí động cơ">Vị trí động cơ</option></select></label>
        <label class="mission-field">Vì sao con chọn thay đổi này?<textarea data-role="mission-reason" maxlength="160" placeholder="Con nghĩ thay đổi này sẽ giúp..."></textarea></label>
        <p class="mission-error" data-role="mission-error" aria-live="polite"></p>
        <button class="btn-stem btn-primary mission-primary" data-action="save-supply-variable">Sửa Version 2</button>`;
    } else if (mission.stage === "reflection") {
      const first = mission.attempts[0];
      const second = mission.attempts[1];
      content.innerHTML = `
        <p class="mission-kicker">SO SÁNH V1 ↔ V2</p>
        <h2 id="mission-title">Điều gì tạo ra khác biệt?</h2>
        <div class="attempt-comparison">${this.attemptSummary(first)}${this.attemptSummary(second)}</div>
        <p class="tradeoff-copy">${this.tradeoffCopy(first, second)}</p>
        <label class="mission-field">Kết quả nào chứng minh điều đó?<textarea data-role="mission-reflection" maxlength="220" placeholder="Con đã đổi... Kết quả cho thấy..."></textarea></label>
        <label class="mission-check mission-adult-check"><input type="checkbox" data-role="mission-adult-help" /> Có người lớn giúp con sửa sản phẩm trong lần này.</label>
        <p class="mission-error" data-role="mission-error" aria-live="polite"></p>
        <button class="btn-stem btn-primary mission-primary" data-action="save-supply-reflection">Hoàn thành</button>`;
    } else {
      const first = mission.attempts[0];
      const second = mission.attempts[1];
      content.innerHTML = `
        <p class="mission-kicker">BÁO CÁO KỸ SƯ NHÍ</p>
        <h2 id="mission-title">Con đã thử nghiệm có kiểm soát</h2>
        <p class="mission-lead">Con thay đổi <strong>${this.escapeHtml(mission.variableChanged ?? "một biến")}</strong> và dùng kết quả hai lần test để kiểm tra ý tưởng.</p>
        <div class="attempt-comparison">${this.attemptSummary(first)}${this.attemptSummary(second)}</div>
        <blockquote class="reflection-quote">“${this.escapeHtml(mission.reflection ?? "Con đã quan sát và cải tiến thiết kế.")}”</blockquote>
        <section class="parent-evidence"><b>Dành cho phụ huynh</b><p><strong>Kỹ năng:</strong> Thử nghiệm có kiểm soát.</p><p><strong>Bằng chứng:</strong> Con thay đổi ${this.escapeHtml(mission.variableChanged ?? "một biến")}; quãng đường ${String(first?.distanceCm ?? 0)}cm → ${String(second?.distanceCm ?? 0)}cm.</p><p><strong>Mức hỗ trợ:</strong> Gợi ý cao nhất Level ${String(mission.highestHintTier)}/5; ${mission.adultHelp ? "có người lớn hỗ trợ" : "không ghi nhận người lớn can thiệp"}.</p></section>
        <button class="btn-stem btn-primary mission-primary" data-action="close-supply-mission">Về xưởng</button>`;
    }
  }

  private renderChallengeBriefing(briefing: AppViewModel["challengeBriefing"], hasSupplyMission: boolean): void {
    const chip = this.element("mission-chip");
    const modal = this.element("challenge-briefing-modal");
    if (briefing === undefined) {
      modal.style.display = "none";
      if (!hasSupplyMission) chip.style.display = "none";
      return;
    }
    const { challenge } = briefing;
    chip.style.display = "inline-flex";
    chip.textContent = `${challenge.icon} Nhiệm vụ`;
    modal.style.display = briefing.showModal ? "flex" : "none";
    if (!briefing.showModal) return;
    const mission = challenge.mission;
    this.element("challenge-briefing-content").innerHTML = `
      <p class="mission-kicker">${this.escapeHtml(mission.kicker)}</p>
      <h2 id="challenge-briefing-title">${this.escapeHtml(challenge.title)}</h2>
      <p class="mission-lead">${this.escapeHtml(mission.context)}</p>
      <div class="mission-scene" aria-label="Lộ trình nhiệm vụ"><span>${this.escapeHtml(mission.route[0])}</span><b>→</b><span>${this.escapeHtml(mission.route[1])}</span></div>
      <p class="mission-objective"><strong>Nhiệm vụ:</strong> ${this.escapeHtml(mission.objective)}</p>
      <ul class="mission-rules">${mission.rules.map((rule) => `<li>${this.escapeHtml(rule)}</li>`).join("")}</ul>
      <p class="mission-success"><strong>Hoàn thành khi:</strong> ${this.escapeHtml(mission.success)}</p>
      <button class="btn-stem btn-primary mission-primary" data-action="close-challenge-briefing">Con nhận nhiệm vụ</button>`;
  }

  private attemptSummary(attempt: NonNullable<AppViewModel["supplyMission"]>["attempts"][number] | undefined): string {
    if (attempt === undefined) return "";
    return `<article class="attempt-card"><b>Version ${String(attempt.version)}</b><span>${attempt.completed ? "✓ Tới nơi" : "Chưa tới nơi"}</span><dl><div><dt>Quãng đường</dt><dd>${String(attempt.distanceCm)}cm</dd></div><div><dt>Thời gian</dt><dd>${attempt.elapsedSeconds.toFixed(1)}s</dd></div><div><dt>Supply Pod</dt><dd>${attempt.touchedFlood ? "Chạm nước" : attempt.stable ? "Ổn định" : "Bị nghiêng"}</dd></div><div><dt>Linh kiện</dt><dd>${String(attempt.partCount)}</dd></div></dl></article>`;
  }

  private tradeoffCopy(first: NonNullable<AppViewModel["supplyMission"]>["attempts"][number] | undefined, second: NonNullable<AppViewModel["supplyMission"]>["attempts"][number] | undefined): string {
    if (first === undefined || second === undefined) return "Hai lần test cho con hai bằng chứng khác nhau.";
    const distanceChange = second.distanceCm - first.distanceCm;
    const timeChange = second.elapsedSeconds - first.elapsedSeconds;
    const distance = distanceChange === 0 ? "quãng đường không đổi" : `đi ${String(Math.abs(distanceChange))}cm ${distanceChange > 0 ? "xa hơn" : "ngắn hơn"}`;
    const time = Math.abs(timeChange) < 0.1 ? "thời gian gần như giữ nguyên" : `${Math.abs(timeChange).toFixed(1)} giây ${timeChange > 0 ? "chậm hơn" : "nhanh hơn"}`;
    return `Version 2 ${distance} và ${time}. Đây là sự đánh đổi, không phải mọi chỉ số đều tốt hơn.`;
  }

  private escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
