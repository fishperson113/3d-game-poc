import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const partId = process.argv[2];
if (!partId || !/^core\.[a-z0-9-]+$/.test(partId)) {
  console.error("Usage: npm run part:preview -- <part-id>");
  process.exit(1);
}

const folder = partId.replace(/^core\./, "");
const manifestPath = resolve("src", "parts", folder, "manifest.json");
try {
  await access(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.id !== partId) throw new Error("manifest id mismatch");
  const viteEntry = resolve("node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteEntry, "--mode", "part-preview", "--host", "127.0.0.1"], { env: { ...process.env, VITE_PART_PREVIEW_ID: partId }, stdio: "inherit" });
  child.on("exit", (code, signal) => { if (signal !== null) process.kill(process.pid, signal); else process.exit(code ?? 1); });
} catch (error) {
  console.error(`Part preview failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
