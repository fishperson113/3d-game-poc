import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src/building/domain");

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [target] : [];
  });
}

const violations = [];
// Resolve imports and re-exports transitively; omit DOM libraries so browser
// globals and types are rejected by the compiler, including aliased references.
const program = ts.createProgram(filesIn(root), {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2023.d.ts"], types: [], strict: true, noEmit: true,
});
const allowed = [root, path.resolve("src/kernel")];
let checked = 0;
for (const source of program.getSourceFiles()) {
  if (program.isSourceFileDefaultLibrary(source)) continue;
  checked += 1;
  const file = path.resolve(source.fileName);
  if (!allowed.some((directory) => file.startsWith(directory + path.sep))) {
    violations.push(`Forbidden transitive dependency: ${path.relative(process.cwd(), file)}`);
  }
}
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) violations.push(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n",
}));

if (violations.length > 0) {
  console.error("Building domain boundary violations:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Building domain dependency graph OK (${checked} files; ES2023 only, no DOM)`);
}
