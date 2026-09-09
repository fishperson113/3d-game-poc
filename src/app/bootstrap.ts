import { APP_NAME } from "../kernel/runtime-contract";
import { initializeRapier } from "../adapters/rapier/rapier-physics-world";
import { createApplicationComposition } from "./composition-root";
import { SandboxApplication } from "./sandbox-application";
import { PartPreviewApplication } from "./part-preview-application";

export function bootstrapApplication(host: HTMLElement): void {
  host.setAttribute("aria-label", APP_NAME);
  void initializeRapier().then(async () => {
    const composition = createApplicationComposition();
    const previewPartId = (import.meta.env as Record<string, string | undefined>).VITE_PART_PREVIEW_ID;
    const application = import.meta.env.MODE === "part-preview" && previewPartId !== undefined
      ? new PartPreviewApplication(host, composition, previewPartId)
      : new SandboxApplication(host, composition);
    if (application instanceof SandboxApplication) await application.initialize();
    window.addEventListener("beforeunload", () => { void application.dispose(); }, { once: true });
    if (import.meta.hot) import.meta.hot.dispose(() => { void application.dispose(); });
  }).catch((error: unknown) => {
    host.innerHTML = `<section class="boot-error"><p class="eyebrow">BOOT ERROR</p><h1>Rapier could not initialize</h1><p>${error instanceof Error ? error.message : String(error)}</p></section>`;
  });
}
