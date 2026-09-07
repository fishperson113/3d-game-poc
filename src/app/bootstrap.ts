import { APP_NAME, FIXED_TIMESTEP_SECONDS } from "../kernel/runtime-contract";

export function bootstrapApplication(host: HTMLElement): void {
  host.innerHTML = `
    <section class="shell" aria-labelledby="app-title">
      <p class="eyebrow">Walking skeleton</p>
      <h1 id="app-title">${APP_NAME}</h1>
      <p>Module boundaries and content contracts are ready for parallel implementation.</p>
      <dl><div><dt>Mode</dt><dd>LoadingChallenge</dd></div><div><dt>Physics step</dt><dd>1/${String(1 / FIXED_TIMESTEP_SECONDS)} s</dd></div></dl>
    </section>`;
}
