import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
  const workspacePath = path.resolve(extensionDevelopmentPath, "test-fixtures", "dart_project");
  const extensionsDir = mkdtempSync(path.join(tmpdir(), "flutter-reference-extensions-"));
  const benchmarkFixture = path.join(workspacePath, "lib", "benchmark_fixture.dart");
  try {
    if (existsSync(benchmarkFixture)) throw new Error(`Refusing to overwrite ${benchmarkFixture}.`);
    writeFileSync(benchmarkFixture, createBenchmarkFixture(120), "utf8");
    let vscodeExecutablePath = await downloadAndUnzipVSCode("stable");
    // VS Code 1.136 renamed the macOS executable from Electron to Code before
    // @vscode/test-electron updated its resolver.
    if (process.platform === "darwin" && !existsSync(vscodeExecutablePath)) {
      vscodeExecutablePath = vscodeExecutablePath.replace(/\/Electron$/, "/Code");
    }
    const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
    execFileSync(
      cliPath,
      ["--extensions-dir", extensionsDir, "--install-extension", "Dart-Code.dart-code", "--force"],
      {
        stdio: "inherit",
        shell: process.platform === "win32"
      }
    );
    // Codex/Cursor terminals inherit extension-host variables. They must not
    // leak into the fresh Electron application under test.
    delete process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.VSCODE_ESM_ENTRYPOINT;
    delete process.env.VSCODE_HANDLES_UNCAUGHT_ERRORS;
    delete process.env.VSCODE_IPC_HOOK;
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath, "--extensions-dir", extensionsDir, "--disable-workspace-trust"]
    });
  } finally {
    rmSync(benchmarkFixture, { force: true });
    rmSync(extensionsDir, { recursive: true, force: true });
  }
}

function createBenchmarkFixture(symbolCount: number): string {
  const methods = Array.from({ length: symbolCount }, (_, index) => `  int method${index}() => ${index};`).join("\n");
  const calls = Array.from({ length: symbolCount }, (_, index) => `  value += fixture.method${index}();`).join("\n");
  return `class BenchmarkFixture {\n${methods}\n}\n\nint exerciseBenchmark() {\n  final fixture = BenchmarkFixture();\n  var value = 0;\n${calls}\n  return value;\n}\n`;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
