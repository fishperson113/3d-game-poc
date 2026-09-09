import type { MachineBlueprint } from "../../building/domain/contracts";
import type { EventEnvelope } from "../../kernel/events/contracts";
import type { RuntimeState } from "../../kernel/runtime-contract";

export interface AppViewModel {
  readonly state: RuntimeState;
  readonly blueprint: MachineBlueprint;
  readonly selectedPartId?: string;
  readonly feedback?: { readonly tone: "good" | "bad" | "neutral"; readonly message: string };
  readonly placement?: { readonly definitionId: string; readonly candidateIndex: number; readonly candidateCount: number; readonly valid: boolean };
  readonly visualVariants: Readonly<Record<string, string>>;
  readonly events: readonly EventEnvelope[];
  readonly eventFilter: string;
}

const palette = [
  ["core.structural-block", "Structural block", "Frame block with six named mounts"],
  ["core.powered-wheel", "Powered wheel", "Motor wheel · W/S or ↑/↓"],
  ["core.steering-hinge", "Steering hinge", "Servo hinge · A/D or ←/→"],
] as const;

export class AppView {
  private readonly root: HTMLElement;

  public constructor(private readonly host: HTMLElement) {
    host.innerHTML = `
      <div class="sandbox-shell">
        <header class="topbar">
          <div><p class="eyebrow">PLAN 04 / ASSEMBLY LAB</p><h1>Machine Sandbox</h1><p class="subhead">Snap parts. Start the rig. Feel the frame move.</p></div>
          <div class="status-cluster"><span class="status-dot"></span><span data-role="runtime-state">Loading</span><span class="physics-chip">Rapier · 60 Hz</span></div>
        </header>
        <div class="toolbar" data-role="toolbar">
          <button data-action="start" class="primary">Start</button><button data-action="stop">Stop</button><button data-action="reset">Reset</button><button data-action="sample">Load sample</button>
          <span class="toolbar-hint">Build mode: click a part, choose a socket, confirm. R rotates ghost · Esc cancels · Delete removes.</span>
        </div>
        <div class="sandbox-grid">
          <aside class="panel left-panel">
            <div class="panel-heading"><span>Palette</span><span class="micro">3 parts</span></div>
            <div class="palette" data-role="palette"></div>
            <div class="panel-heading inspector-heading"><span>Inspector</span><span class="micro" data-role="selection-label">none</span></div>
            <div data-role="inspector" class="inspector empty">Select a part in the viewport.</div>
            <div class="panel-heading"><span>Visual QA</span><span class="micro">variant is not saved</span></div>
            <div class="variant-controls" data-role="variants"></div>
            <div class="feedback" data-role="feedback" aria-live="polite">Booting sandbox…</div>
          </aside>
          <main class="viewport-panel"><div class="viewport" data-role="viewport"></div><div class="viewport-overlay"><span class="mode-label">BUILD / PHYSICS VIEW</span><span class="placement-label" data-role="placement-label">Ready to place a root block.</span><div class="placement-actions" data-role="placement-actions"><button data-action="previous-socket">← socket</button><button data-action="next-socket">socket →</button><button data-action="rotate-placement">Rotate 90°</button><button data-action="confirm-placement" class="primary">Confirm</button><button data-action="cancel-placement">Cancel</button></div></div></main>
          <aside class="panel events-panel">
            <div class="panel-heading"><span>Event viewer</span><button data-action="export" class="text-button">Export JSON</button></div>
            <label class="event-filter">Filter <input data-role="event-filter" placeholder="all events" /></label>
            <div data-role="events" class="events" aria-live="polite"></div>
          </aside>
        </div>
      </div>`;
    const paletteHost = this.element("palette");
    paletteHost.innerHTML = palette.map(([id, label, description]) => `<button class="palette-card" data-action="palette" data-part-id="${id}"><span class="palette-swatch swatch-${id.replace("core.", "")}"></span><span><strong>${label}</strong><small>${description}</small></span><span class="plus">+</span></button>`).join("");
    this.root = host.firstElementChild as HTMLElement;
  }

  public getElement(role: string): HTMLElement { return this.element(role); }

  public render(model: AppViewModel): void {
    this.root.dataset.runtimeState = model.state;
    this.element("runtime-state").textContent = model.state;
    const selection = model.selectedPartId === undefined ? undefined : model.blueprint.parts.find((part) => String(part.id) === model.selectedPartId);
    this.element("selection-label").textContent = selection === undefined ? "none" : String(selection.id);
    const inspector = this.element("inspector");
    if (selection === undefined) {
      inspector.className = "inspector empty";
      inspector.textContent = "Select a part in the viewport.";
    } else {
      inspector.className = "inspector";
      const config = Object.entries(selection.configuration ?? {}).map(([key, value]) => `<div class="inspector-row"><span>${key}</span><code>${JSON.stringify(value)}</code></div>`).join("");
      const links = model.blueprint.connections.filter((connection) => String(connection.a.partId) === String(selection.id) || String(connection.b.partId) === String(selection.id)).map((connection) => `<div class="connection-row"><span>${String(connection.id)}</span><button data-action="disconnect" data-connection-id="${String(connection.id)}">disconnect</button></div>`).join("");
      inspector.innerHTML = `<div class="part-id">${selection.definitionId}</div><div class="inspector-row"><span>position</span><code>${selection.transform.position.map((value) => value.toFixed(2)).join(" ")}</code></div>${config || "<div class=inspector-note>default contract values</div>"}<div class="inspector-subheading">connections</div>${links || "<div class=inspector-note>none</div>"}<div class="inspector-actions"><button data-action="rotate-selected">Rotate 90°</button><button data-action="delete-selected" class="danger-button">Delete selected</button></div>`;
    }
    const placementLabel = this.element("placement-label");
    const placement = model.placement;
    placementLabel.textContent = placement === undefined ? (model.blueprint.parts.length === 0 ? "Ready to place a root block." : "Choose a palette part to create a ghost.") : `${placement.definitionId} · socket candidate ${String(placement.candidateIndex + 1)}/${String(placement.candidateCount)} · ${placement.valid ? "valid" : "invalid"}`;
    this.element("placement-actions").style.display = placement === undefined ? "none" : "flex";
    this.element("feedback").className = `feedback ${model.feedback?.tone ?? "neutral"}`;
    this.element("feedback").textContent = model.feedback?.message ?? "Ready.";
    const variants = this.element("variants");
    variants.innerHTML = palette.map(([id, label]) => `<label><span>${label}</span><select data-action="variant" data-part-id="${id}"><option value="A"${model.visualVariants[id] === "A" ? " selected" : ""}>A</option><option value="B"${model.visualVariants[id] === "B" ? " selected" : ""}>B</option></select></label>`).join("");
    const eventsHost = this.element("events");
    const filter = model.eventFilter.trim().toLowerCase();
    const filtered = filter.length === 0 ? model.events : model.events.filter((event) => event.type.toLowerCase().includes(filter) || JSON.stringify(event.payload).toLowerCase().includes(filter));
    eventsHost.innerHTML = filtered.slice(-80).reverse().map((event) => `<article class="event-row ${event.severity}"><div><b>${event.type}</b><span>#${String(event.sequence)}</span></div><small>${JSON.stringify(event.payload)}</small></article>`).join("") || `<div class="empty events-empty">No matching events.</div>`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-action=start], [data-action=stop], [data-action=reset], [data-action=sample]").forEach((button) => { button.disabled = (model.state === "Running" && (button.dataset.action === "start" || button.dataset.action === "sample")) || (model.state !== "Running" && button.dataset.action === "stop"); });
  }

  private element(role: string): HTMLElement {
    const result = this.host.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (result === null) throw new Error(`Missing app view role: ${role}`);
    return result;
  }
}
