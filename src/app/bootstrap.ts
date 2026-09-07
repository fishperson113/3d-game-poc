import { APP_NAME, FIXED_TIMESTEP_SECONDS } from "../kernel/runtime-contract";
import { createApplicationComposition } from "./composition-root";
import { AppView } from "./ui/app-view";

export function bootstrapApplication(host: HTMLElement): void {
  const composition = createApplicationComposition();
  const view = new AppView(host);
  host.innerHTML = `
    <section class="shell" aria-labelledby="app-title">
      <p class="eyebrow">Walking skeleton</p>
      <h1 id="app-title">${APP_NAME}</h1>
      <p>Module boundaries and content contracts are ready for parallel implementation.</p>
      <dl><div><dt>Mode</dt><dd>LoadingChallenge</dd></div><div><dt>Physics step</dt><dd>1/${String(1 / FIXED_TIMESTEP_SECONDS)} s</dd></div></dl>
    </section>`;
  view.render({ state: "LoadingChallenge" });

  // TODO(plan-05): Mount controllers and transition to Building after level load.
  void composition;
}
