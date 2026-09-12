import type { AICompanionService, AICompanionState } from "../application/ai-companion-service";
import type { HintTier } from "../domain/contracts";

export class AITutorWidget {
  private readonly root: HTMLElement;

  public constructor(
    private readonly host: HTMLElement,
    private readonly aiService: AICompanionService,
    private readonly onOpenBuildModal: () => void
  ) {
    this.root = document.createElement("div");
    this.root.className = "ai-tutor-container";
    this.host.appendChild(this.root);

    this.aiService.subscribe((state) => {
      this.render(state);
    });
  }

  private render(state: AICompanionState): void {
    const { isWidgetOpen, currentDiagnosis, currentHints, activeHintTier, highestTierUnlocked, isCelebration, celebrationMessage } = state;

    if (!isWidgetOpen) {
      // Floating avatar button
      this.root.innerHTML = `
        <button class="ai-avatar-btn ${currentDiagnosis ? "has-alert" : ""}" data-action="toggle-ai" title="Trò chuyện với Trợ Giảng Rô-Bô AI">
          <span class="ai-avatar-icon">🤖</span>
          <span class="ai-avatar-text">Rô-Bô AI</span>
          ${currentDiagnosis ? '<span class="ai-alert-badge">!</span>' : ""}
        </button>
      `;
      this.root.querySelector('[data-action="toggle-ai"]')?.addEventListener("click", () => {
        this.aiService.toggleWidget(true);
      });
      return;
    }

    // Expanded speech bubble / tutor dialog
    if (isCelebration) {
      this.root.innerHTML = `
        <div class="ai-bubble celebration">
          <div class="ai-bubble-header">
            <div class="ai-header-title">
              <span class="ai-robot-badge">🤖 Rô-Bô AI</span>
              <span class="ai-celebration-title">🎉 Chúc Mừng Kỹ Sư Nhí!</span>
            </div>
            <button class="ai-close-btn" data-action="close-ai" title="Thu nhỏ">✕</button>
          </div>
          <div class="ai-bubble-body">
            <p class="ai-speech-text">${celebrationMessage ?? "Em đã hoàn thành xuất sắc thử thách!"}</p>
          </div>
          <div class="ai-bubble-footer">
            <button class="btn-stem btn-stem-primary ai-action-btn" data-action="open-build-modal">
              📦 Xem Cẩm Nang Lắp Ráp Ngoài Đời Thật
            </button>
          </div>
        </div>
      `;
      this.bindEvents();
      return;
    }

    const activeHint = currentHints.find((h) => h.tier === activeHintTier) ?? currentHints[0];
    const tierPillsHtml = [1, 2, 3, 4, 5]
      .map((tierNum) => {
        const isUnlocked = tierNum <= highestTierUnlocked;
        const isActive = tierNum === activeHintTier;
        const disabledAttr = isUnlocked ? "" : "disabled";
        const classNames = `tier-pill ${isActive ? "active" : ""} ${isUnlocked ? "unlocked" : "locked"}`;
        return `<button class="${classNames}" data-tier="${String(tierNum)}" ${disabledAttr} title="Tầng ${String(tierNum)}">T${String(tierNum)}</button>`;
      })
      .join("");

    const categoryIcons: Record<string, string> = {
      reminder: "📌",
      socratic_question: "❓",
      focus_area: "🔍",
      stem_principle: "🔬",
      actionable_step: "🛠️",
    };
    const catIcon = activeHint ? categoryIcons[activeHint.category] ?? "💡" : "💡";

    this.root.innerHTML = `
      <div class="ai-bubble ${currentDiagnosis ? "alert-mode" : ""}">
        <div class="ai-bubble-header">
          <div class="ai-header-title">
            <span class="ai-robot-badge">🤖 Rô-Bô AI</span>
            <span class="ai-topic-title">${currentDiagnosis ? currentDiagnosis.title : "Trợ Giảng STEM"}</span>
          </div>
          <button class="ai-close-btn" data-action="close-ai" title="Thu nhỏ">✕</button>
        </div>

        <div class="ai-tier-nav">
          <span class="tier-nav-label">Cấp độ gợi ý:</span>
          <div class="tier-pill-group">${tierPillsHtml}</div>
        </div>

        <div class="ai-bubble-body">
          ${
            activeHint
              ? `
            <div class="ai-hint-card tier-${String(activeHint.tier)}">
              <div class="ai-hint-badge">
                <span>${catIcon} ${activeHint.tierLabel}</span>
              </div>
              <h4 class="ai-hint-title">${activeHint.title}</h4>
              <p class="ai-speech-text">${activeHint.content}</p>
              ${
                activeHint.stemPrinciple
                  ? `<div class="ai-stem-principle"><strong>📖 Khái niệm STEM:</strong> ${activeHint.stemPrinciple}</div>`
                  : ""
              }
              ${
                activeHint.actionPrompt
                  ? `<div class="ai-action-prompt"><strong>👉 Hành động:</strong> ${activeHint.actionPrompt}</div>`
                  : ""
              }
            </div>
          `
              : `<p class="ai-speech-text">Hãy bấm 'Lái Thử'. Rô-Bô sẽ theo dõi và hỗ trợ em khi gặp thử thách nhé!</p>`
          }
        </div>

        <div class="ai-bubble-footer">
          ${
            activeHintTier < 5
              ? `<button class="btn-stem btn-stem-secondary ai-next-tier-btn" data-action="next-tier">
                  💡 Xem Gợi Ý Sâu Hơn (Tầng ${String(activeHintTier + 1)}) ➔
                 </button>`
              : `<button class="btn-stem btn-stem-primary ai-action-btn" data-action="open-build-modal">
                  📦 Xem Cẩm Nang Lắp Ráp Ngoài Đời
                 </button>`
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelector('[data-action="close-ai"]')?.addEventListener("click", () => {
      this.aiService.toggleWidget(false);
    });

    this.root.querySelector('[data-action="open-build-modal"]')?.addEventListener("click", () => {
      this.onOpenBuildModal();
    });

    this.root.querySelector('[data-action="next-tier"]')?.addEventListener("click", () => {
      this.aiService.unlockNextTier();
    });

    this.root.querySelectorAll<HTMLButtonElement>("button[data-tier]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tier = Number(btn.dataset.tier) as HintTier;
        if (tier >= 1 && tier <= 5) {
          this.aiService.setHintTier(tier);
        }
      });
    });
  }

  public dispose(): void {
    this.root.remove();
  }
}
