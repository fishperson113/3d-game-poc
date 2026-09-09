import { asPartId, type MachineBlueprint } from "../building/domain/contracts";
import { defaultSimulationEnvironment } from "../simulation";
import { ThreeSimulationRenderer } from "../adapters/three/three-simulation-renderer";
import type { ApplicationComposition } from "./composition-root";

export class PartPreviewApplication {
  private readonly renderer: ThreeSimulationRenderer;
  private readonly root: HTMLElement;
  private readonly blueprint: MachineBlueprint;
  private disposed = false;
  private readonly onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    if (target.dataset.role !== "preview-variant") return;
    this.renderer.setBlueprint(this.blueprint, this.composition.catalog, { [this.partId]: target.value });
    this.renderer.setSelection("preview-part");
  };

  public constructor(private readonly host: HTMLElement, private readonly composition: ApplicationComposition, private readonly partId: string) {
    const manifest = composition.catalog.listManifests().find((candidate) => candidate.id === partId);
    if (manifest === undefined) throw new Error(`preview.part.not-found:${partId}`);
    this.blueprint = { schemaVersion: 1, id: "part-preview" as MachineBlueprint["id"], version: 0, parts: [{ id: asPartId("preview-part"), definitionId: partId, transform: { position: [0, 1, 0], rotation: [0, 0, 0] } }], connections: [], controlBindings: [] };
    host.innerHTML = `<main class="part-preview"><header><p class="eyebrow">PLAN 04 / ISOLATED PART PREVIEW</p><h1>${partId}</h1><p>Authoritative sockets, colliders and model variants share this one part frame.</p></header><section class="part-preview-grid"><div class="preview-viewport" data-role="preview-viewport"></div><aside class="preview-inspector"><label>Visual variant <select data-role="preview-variant"><option value="A">A</option><option value="B">B</option></select></label><h2>Assembly sockets</h2><pre>${manifest.assembly.sockets.map((socket) => `${socket.id}\n  pos ${socket.position.join(" ")} rot ${(socket.rotation ?? [0, 0, 0]).join(" ")}`).join("\n")}</pre><h2>Physics colliders</h2><pre>${manifest.physics.colliders.map((collider) => `${collider.shape} ${collider.position.join(" ")}\n  friction ${String(collider.friction)}`).join("\n")}</pre><p class="preview-provenance">${manifest.visual.source} · visual revision ${String(manifest.visual.revision)} · ${manifest.provenance.license}</p></aside></section></main>`;
    this.root = host.firstElementChild as HTMLElement;
    this.renderer = new ThreeSimulationRenderer();
    this.renderer.mount(this.root.querySelector<HTMLElement>('[data-role="preview-viewport"]') as HTMLElement);
    this.renderer.setEnvironment(defaultSimulationEnvironment());
    this.renderer.setBlueprint(this.blueprint, composition.catalog, { [partId]: "A" });
    this.renderer.setSelection("preview-part");
    host.addEventListener("change", this.onChange);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.removeEventListener("change", this.onChange);
    this.renderer.dispose();
  }
}
