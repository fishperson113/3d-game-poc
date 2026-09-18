import "./styles.css";
import { bootstrapApplication } from "./app/bootstrap";
import { AuthGate, mountAccountDock } from "./auth/auth-gate";

const host = document.querySelector<HTMLElement>("#app");
if (host === null) throw new Error("Missing #app host element");

const gate = new AuthGate(host, (access) => {
  host.replaceChildren();
  bootstrapApplication(host);
  mountAccountDock(access, () => {
    document.querySelector(".account-dock")?.remove();
    if (access.role === "child") {
      void fetch("/api/child/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() => gate.initialize());
    } else {
      void gate.initialize();
    }
  });
});
void gate.initialize();
