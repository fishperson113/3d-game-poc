import "./styles.css";
import { bootstrapApplication } from "./app/bootstrap";

const host = document.querySelector<HTMLElement>("#app");
if (host === null) throw new Error("Missing #app host element");

bootstrapApplication(host);
