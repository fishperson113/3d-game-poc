import { APP_NAME } from "../kernel/runtime-contract";
import { initializeRapier } from "../adapters/rapier/rapier-physics-world";
import { createApplicationComposition } from "./composition-root";
import { SandboxApplication } from "./sandbox-application";
import { PartPreviewApplication } from "./part-preview-application";

export function bootstrapApplication(host: HTMLElement): void {
  host.setAttribute("aria-label", APP_NAME);
  const boot = async (): Promise<void> => {
    try {
      await initializeRapier();
      const composition = createApplicationComposition();
      const previewPartId = (import.meta.env as Record<string, string | undefined>).VITE_PART_PREVIEW_ID;
      const application = import.meta.env.MODE === "part-preview" && previewPartId !== undefined
        ? new PartPreviewApplication(host, composition, previewPartId)
        : new SandboxApplication(host, composition);
      if (application instanceof SandboxApplication) await application.initialize();
      window.addEventListener("beforeunload", () => { void application.dispose(); }, { once: true });
      if (import.meta.hot) import.meta.hot.dispose(() => { void application.dispose(); });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      host.replaceChildren();
      const section = document.createElement("section");
      section.className = "boot-error";
      const label = document.createElement("p"); label.className = "eyebrow"; label.textContent = "BOOT ERROR";
      const heading = document.createElement("h1"); heading.textContent = "Sandbox could not initialize";
      const detail = document.createElement("p"); detail.textContent = reason;
      const retry = document.createElement("button"); retry.className = "primary"; retry.textContent = "Retry startup";
      retry.addEventListener("click", () => { retry.disabled = true; void boot(); }, { once: true });
      section.append(label, heading, detail, retry);
      host.append(section);
    }
  };
  void boot();
}
