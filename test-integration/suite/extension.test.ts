import { strict as assert } from "node:assert";
import * as vscode from "vscode";

describe("Flutter Reference extension", () => {
  it("activates and discovers semantic Dart symbols", async () => {
    const extension = vscode.extensions.getExtension("trancongtien.flutter-reference-lens");
    assert.ok(extension, "Extension was not discovered by the host.");
    await extension.activate();
    assert.equal(extension.isActive, true);

    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "lib", "reference_fixture.dart");
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    const symbols = await waitForSymbols(uri);
    assert.ok(symbols.some((symbol) => symbol.name === "Repository"));
    assert.ok(symbols.some((symbol) => symbol.name === "topLevel"));
    const allNames = flattenSymbols(symbols).map((symbol) => symbol.name);
    assert.ok(
      allNames.some((name) => name.startsWith("load")),
      JSON.stringify(
        flattenSymbols(symbols).map((symbol) => ({
          name: symbol.name,
          kind: symbol.kind,
          children: symbol.children.length
        }))
      )
    );
    assert.ok(allNames.includes("Loadable"));
    assert.ok(allNames.includes("StringTools"));
    assert.ok(allNames.includes("StringMapper"));
  });

  it("returns resolved semantic CodeLens", async () => {
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "lib", "reference_fixture.dart");
    const lenses = await waitForLenses(uri);
    assert.ok(lenses.length > 0, "No Flutter Reference CodeLens were returned.");
    assert.ok(
      lenses.some((lens) => lens.command?.title.includes("usage")),
      "No usage lens was resolved."
    );
  });

  it("keeps duplicate method names semantically separate", async () => {
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "lib", "reference_fixture.dart");
    const document = await vscode.workspace.openTextDocument(uri);
    const lenses = await waitForLenses(uri);
    const loadTitles = lenses
      .filter((lens) => document.getText(lens.range) === "load")
      .map((lens) => lens.command?.title ?? "");
    const lensDebug = lenses.map((lens) => ({
      text: document.getText(lens.range),
      line: lens.range.start.line,
      title: lens.command?.title
    }));
    assert.ok(loadTitles.filter((title) => title === "1 usage").length >= 2, JSON.stringify(lensDebug));
  });

  it("reports implementation and test-aware reference results", async () => {
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "lib", "reference_fixture.dart");
    const document = await vscode.workspace.openTextDocument(uri);
    const lenses = await waitForLenses(uri);
    const repositoryLine = document.positionAt(document.getText().indexOf("abstract class Repository")).line;
    const repositoryTitles = lenses
      .filter((lens) => lens.range.start.line === repositoryLine)
      .map((lens) => lens.command?.title ?? "");
    assert.ok(repositoryTitles.includes("1 implementation"));

    const topLevelLine = document.positionAt(document.getText().indexOf("String topLevel")).line;
    const topLevelTitles = lenses
      .filter((lens) => lens.range.start.line === topLevelLine)
      .map((lens) => lens.command?.title ?? "");
    assert.ok(topLevelTitles.includes("2 usages"), JSON.stringify(topLevelTitles));
  });

  it("resolves a large-file sample within the regression budget and reuses cache", async () => {
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "lib", "benchmark_fixture.dart");
    await vscode.workspace.openTextDocument(uri);
    const coldStart = performance.now();
    const cold = await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", uri, 20);
    const coldDuration = performance.now() - coldStart;
    assert.ok(cold?.length, "Large fixture produced no lenses.");
    assert.ok(coldDuration < 30_000, `Cold resolution exceeded 30s: ${coldDuration.toFixed(0)}ms.`);

    const cachedStart = performance.now();
    await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", uri, 20);
    const cachedDuration = performance.now() - cachedStart;
    assert.ok(cachedDuration < 5_000, `Cached resolution exceeded 5s: ${cachedDuration.toFixed(0)}ms.`);
  });
});

function flattenSymbols(symbols: readonly vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flattenSymbols(symbol.children)]);
}

async function waitForSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  return retry(async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      uri
    );
    return symbols?.length ? symbols : undefined;
  });
}

async function waitForLenses(uri: vscode.Uri): Promise<vscode.CodeLens[]> {
  return retry(async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", uri, 100);
    return lenses?.some((lens) => lens.command) ? lenses : undefined;
  });
}

async function retry<T>(operation: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = await operation();
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Timed out waiting for Dart language service.");
}
