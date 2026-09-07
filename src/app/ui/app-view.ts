import type { RuntimeState } from "../../kernel/runtime-contract";

export interface AppViewModel {
  readonly state: RuntimeState;
  readonly levelTitle?: string;
}

export class AppView {
  public constructor(private readonly host: HTMLElement) {}

  public render(model: AppViewModel): void {
    // TODO(plan-05): Replace the bootstrap placeholder with semantic DOM regions.
    this.host.dataset.runtimeState = model.state;
  }
}
