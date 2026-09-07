import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const partId = process.argv[2];
if (!partId) {
  console.error("Usage: npm run part:validate -- <part-id>");
  process.exitCode = 1;
} else {
  const folder = partId.replace(/^core\./, "");
  const manifestPath = resolve("src", "parts", folder, "manifest.json");
  try {
    await access(manifestPath);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.id !== partId || manifest.kind !== "core.part") throw new Error("manifest id/kind mismatch");
    console.log(`Validated ${partId}`);
  } catch (error) {
    console.error(`Part validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
