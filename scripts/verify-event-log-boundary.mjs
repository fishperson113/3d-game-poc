import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourceRoots = [path.resolve("src/kernel/events"), path.resolve("src/event-log"), path.resolve("src/adapters/event-log")];
const allowedRoots = [path.resolve("src/kernel"), path.resolve("src/event-log"), path.resolve("src/adapters/event-log")];

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(target);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [target] : [];
  });
}

const program = ts.createProgram(sourceRoots.flatMap(filesIn), {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2023.d.ts"],
  types: [],
  strict: true,
  noEmit: true,
});
const violations = [];
let checked = 0;

for (const source of program.getSourceFiles()) {
  if (program.isSourceFileDefaultLibrary(source)) continue;
  checked += 1;
  const file = path.resolve(source.fileName);
  if (!allowedRoots.some((root) => file.startsWith(root + path.sep))) {
    violations.push(`Forbidden transitive dependency: ${path.relative(process.cwd(), file)}`);
  }
}

const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  violations.push(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  }));
}

if (violations.length > 0) {
  console.error("Event log foundation boundary violations:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Event log foundation dependency graph OK (${checked} files; ES2023 only, no DOM)`);
}
