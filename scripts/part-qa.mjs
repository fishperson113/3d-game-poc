import { spawnSync } from "node:child_process";

const partId = process.argv[2];
if (!partId) {
  console.error("Usage: npm run part:qa -- <part-id>");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const commands = [
  ["run", "part:validate", "--", partId],
  ["run", "typecheck"],
  ["run", "test", "--", "--run", "part"],
];

for (const args of commands) {
  const result = spawnSync(npmCommand, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
