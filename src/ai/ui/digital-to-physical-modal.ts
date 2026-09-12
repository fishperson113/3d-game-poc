import type { MachineBlueprint } from "../../building/domain/contracts";
import type { AICompanionService, AICompanionState } from "../application/ai-companion-service";

export class DigitalToPhysicalModal {
  private readonly root: HTMLElement;

  public constructor(
    private readonly host: HTMLElement,
    private readonly aiService: AICompanionService,
    private readonly getBlueprint: () => MachineBlueprint,
    private readonly getChallengeTitle: (challengeId: string) => string
  ) {
    this.root = document.createElement("div");
    this.root.className = "build-modal-overlay hidden";
    this.host.appendChild(this.root);

    this.aiService.subscribe((state) => {
      this.render(state);
    });
  }

  private render(state: AICompanionState): void {
    if (!state.showBuildModal) {
      this.root.classList.add("hidden");
      this.root.innerHTML = "";
      return;
    }

    this.root.classList.remove("hidden");
    const blueprint = this.getBlueprint();
    const challengeTitle = this.getChallengeTitle(state.currentChallengeId);
    const bom = this.aiService.getBOM(blueprint);
    const steps = this.aiService.getAssemblySteps(blueprint);
    const checklist = this.aiService.getRealWorldChecklist(state.currentChallengeId);
    const parentReport = this.aiService.getParentReport(challengeTitle);

    const isBuildTab = state.activeModalTab === "build";

    const bomRows = bom
      .map(
        (item) => `
      <div class="bom-card">
        <span class="bom-icon">${item.icon}</span>
        <div class="bom-info">
          <div class="bom-name-row">
            <strong class="bom-name">${item.label}</strong>
            <span class="bom-badge">x${String(item.count)}</span>
          </div>
          <p class="bom-desc">${item.description}</p>
        </div>
      </div>
    `
      )
      .join("");

    const stepsHtml = steps
      .map(
        (step) => `
      <div class="step-card">
        <div class="step-header">
          <span class="step-num">Bước ${String(step.stepNumber)}</span>
          <h4 class="step-title">${step.icon} ${step.title}</h4>
        </div>
        <p class="step-instruction">${step.instruction}</p>
        <div class="step-tip">💡 <strong>Mẹo kỹ thuật:</strong> ${step.tip}</div>
      </div>
    `
      )
      .join("");

    const checklistHtml = checklist
      .map(
        (chk) => `
      <div class="checklist-item">
        <div class="chk-q-row">
          <span class="chk-icon">📝</span>
          <strong class="chk-q">${chk.question}</strong>
        </div>
        <p class="chk-guidance">${chk.guidance}</p>
        <span class="chk-stem-tag">🔬 Khái niệm: ${chk.stemConcept}</span>
      </div>
    `
      )
      .join("");

    const masteredHtml = parentReport.masteredConcepts
      .map((c) => `<span class="concept-badge">✓ ${c}</span>`)
      .join("");

    this.root.innerHTML = `
      <div class="build-modal">
        <div class="build-modal-header">
          <div class="modal-title-group">
            <span class="modal-emoji">📦</span>
            <div>
              <h2 class="modal-main-title">Cẩm Nang Chế Tạo Vật Lý & Báo Cáo Phụ Huynh</h2>
              <p class="modal-sub">Chuyển đổi thiết kế từ máy tính sang bộ STEM thực tế · ${challengeTitle}</p>
            </div>
          </div>
          <button class="modal-close-btn" data-action="close-modal" title="Đóng">✕</button>
        </div>

        <div class="modal-tab-bar">
          <button class="modal-tab ${isBuildTab ? "active" : ""}" data-tab="build">
            🛠️ 1. Lắp Ráp Ngoài Đời (BOM & 4 Bước)
          </button>
          <button class="modal-tab ${!isBuildTab ? "active" : ""}" data-tab="parent">
            👨‍👩‍👧 2. Báo Cáo Phụ Huynh & Năng Lực STEM
          </button>
        </div>

        <div class="build-modal-content">
          ${
            isBuildTab
              ? `
            <div class="tab-pane">
              <section class="modal-section">
                <div class="section-title-row">
                  <h3>📋 Danh Mục Linh Kiện Cần Chuẩn Bị (Bill of Materials)</h3>
                  <span class="section-count">${String(bom.reduce((acc, i) => acc + i.count, 0))} chi tiết</span>
                </div>
                <div class="bom-grid">${bomRows}</div>
              </section>

              <section class="modal-section">
                <h3>🔨 Trình Tự Lắp Ráp Mô Hình Thật</h3>
                <div class="steps-flow">${stepsHtml}</div>
              </section>

              <section class="modal-section">
                <h3>🔍 Phiếu Đối Chiếu Thực Nghiệm Ngoài Đời Thực</h3>
                <p class="checklist-intro">Hãy thử chạy xe thật trên sàn nhà và cùng bạn bè/cha mẹ trả lời các câu hỏi sau:</p>
                <div class="checklist-box">${checklistHtml}</div>
              </section>
            </div>
          `
              : `
            <div class="tab-pane parent-pane">
              <div class="parent-metric-cards">
                <div class="metric-card score-card">
                  <div class="metric-circle">
                    <span class="metric-number">${String(parentReport.autonomyScorePercent)}%</span>
                    <span class="metric-label">Chỉ Số Tự Lập</span>
                  </div>
                  <p class="metric-desc">Tỷ lệ bé tự giải quyết vấn đề mà không phụ thuộc vào lời giải trực tiếp.</p>
                </div>

                <div class="metric-card">
                  <span class="metric-icon">🔄</span>
                  <h4>${String(parentReport.attemptCount)} Lần Thử Nghiệm</h4>
                  <p class="metric-desc">Số vòng lặp thử sai và cải tiến (Design Thinking) trước khi đạt kết quả mong muốn.</p>
                </div>

                <div class="metric-card">
                  <span class="metric-icon">💡</span>
                  <h4>Tầng ${String(parentReport.highestTierUsed)}/5 Gợi Ý</h4>
                  <p class="metric-desc">Mức độ hỗ trợ tối đa bé đã sử dụng từ Trợ Giảng AI.</p>
                </div>
              </div>

              <section class="parent-section">
                <h3>🧠 Khái Niệm STEM Con Đã Nắm Vững</h3>
                <div class="concepts-grid">${masteredHtml}</div>
              </section>

              <section class="parent-section feedback-box">
                <h3>🌟 Nhận Xét Tiến Bộ Của Bé</h3>
                <p class="parent-feedback-text">${parentReport.qualitativeFeedback}</p>
              </section>

              <section class="parent-section prompt-box">
                <h3>💬 Gợi Ý Câu Hỏi Trò Chuyện Cùng Con Sau Buổi Học</h3>
                <p class="parent-prompt-text">"${parentReport.parentDiscussionPrompt}"</p>
              </section>
            </div>
          `
          }
        </div>

        <div class="build-modal-footer">
          <button class="btn-stem btn-stem-secondary" data-action="close-modal">Đóng Cẩm Nang</button>
          ${
            isBuildTab
              ? `<button class="btn-stem btn-stem-primary" data-action="switch-to-parent">Xem Báo Cáo Phụ Huynh ➔</button>`
              : `<button class="btn-stem btn-stem-primary" data-action="switch-to-build">Xem Lại Danh Mục Linh Kiện ➔</button>`
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        this.aiService.closeBuildModal();
      });
    });

    this.root.querySelector('[data-action="switch-to-parent"]')?.addEventListener("click", () => {
      this.aiService.setModalTab("parent");
    });

    this.root.querySelector('[data-action="switch-to-build"]')?.addEventListener("click", () => {
      this.aiService.setModalTab("build");
    });

    this.root.querySelectorAll<HTMLButtonElement>("button[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab === "build" || tab === "parent") {
          this.aiService.setModalTab(tab);
        }
      });
    });

    // Close when clicking outside modal content
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) {
        this.aiService.closeBuildModal();
      }
    });
  }

  public dispose(): void {
    this.root.remove();
  }
}
