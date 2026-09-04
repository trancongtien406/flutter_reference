import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { AgentBridgeServer } from "./agent/bridgeServer";
import { AGENT_PROTOCOL_VERSION } from "./agent/bridgeProtocol";
import { ReferenceCache } from "./cache/referenceCache";
import { DartReferenceCodeLensProvider } from "./codelens/dartCodeLensProvider";
import { getConfig } from "./core/config";
import { Logger } from "./core/logger";
import { QueryQueue } from "./core/queryQueue";
import { SemanticResult } from "./core/types";
import { summarizeImpact } from "./analysis/impact";
import { CallHierarchyResult, CallHierarchyService } from "./dart/callHierarchyService";
import { GitService } from "./git/gitService";
import { SemanticService } from "./dart/semanticService";
import { DartSymbolService } from "./dart/symbolService";
import { assessDeleteSafety } from "./intelligence/safety";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger();
  const symbolService = new DartSymbolService();
  const referenceCache = new ReferenceCache<SemanticResult>();
  const implementationCache = new ReferenceCache<SemanticResult>();
  const hierarchyCache = new ReferenceCache<CallHierarchyResult>();
  const gitCache = new ReferenceCache<string>();
  const queue = new QueryQueue(() => getConfig().maxConcurrentQueries);
  const hierarchy = new CallHierarchyService(queue);
  const provider = new DartReferenceCodeLensProvider(
    symbolService,
    new SemanticService(queue),
    hierarchy,
    referenceCache,
    implementationCache,
    hierarchyCache,
    gitCache,
    new GitService(),
    logger
  );
  const bridge = new AgentBridgeServer();
  let refreshTimer: NodeJS.Timeout | undefined;

  const workspaceId = (vscode.workspace.workspaceFolders ?? [])
    .map((folder) => folder.uri.toString())
    .sort()
    .join("|");
  if (workspaceId) {
    try {
      await bridge.start({
        workspaceId,
        extensionVersion: packageVersion(context.extension.packageJSON),
        descriptorPath: path.join(context.globalStorageUri.fsPath, "agent-bridge.json"),
        handler: (method) => {
          if (method !== "health") throw new Error(`Unsupported bridge method: ${method}`);
          return Promise.resolve({
            status: "READY",
            protocolVersion: AGENT_PROTOCOL_VERSION,
            extensionVersion: packageVersion(context.extension.packageJSON),
            dartExtensionActive: vscode.extensions.getExtension("Dart-Code.dart-code")?.isActive ?? false
          });
        }
      });
      logger.info("Local agent bridge started.");
    } catch (error) {
      logger.error("Local agent bridge failed to start", error);
    }
  }

  const clearCaches = (): void => {
    referenceCache.clear();
    implementationCache.clear();
    hierarchyCache.clear();
    gitCache.clear();
  };
  const refresh = (uri?: vscode.Uri): void => {
    if (uri) {
      referenceCache.invalidateUri(uri.toString());
      implementationCache.invalidateUri(uri.toString());
    }
    provider.refresh();
  };
  const scheduleRefresh = (uri: vscode.Uri): void => {
    // A call-site edit can change the count of a declaration in another file.
    clearCaches();
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => provider.refresh(), getConfig(uri).refreshDebounceMs);
  };

  context.subscriptions.push(
    logger,
    provider,
    { dispose: () => void bridge.dispose() },
    vscode.languages.registerCodeLensProvider({ language: "dart", scheme: "file" }, provider),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "dart") scheduleRefresh(event.document.uri);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === "dart") refresh(document.uri);
    }),
    vscode.workspace.onDidCreateFiles(() => {
      clearCaches();
      provider.refresh();
    }),
    vscode.workspace.onDidDeleteFiles(() => {
      clearCaches();
      provider.refresh();
    }),
    vscode.workspace.onDidRenameFiles(() => {
      clearCaches();
      provider.refresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      clearCaches();
      provider.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("flutterReference")) {
        clearCaches();
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand("flutterReference.enable", async () => {
      await vscode.workspace
        .getConfiguration("flutterReference")
        .update("enabled", true, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand("flutterReference.disable", async () => {
      await vscode.workspace
        .getConfiguration("flutterReference")
        .update("enabled", false, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand("flutterReference.refresh", () => {
      refresh(vscode.window.activeTextEditor?.document.uri);
    }),
    vscode.commands.registerCommand("flutterReference.clearCache", () => {
      clearCaches();
      provider.refresh();
      void vscode.window.showInformationMessage("Flutter Reference cache cleared.");
    }),
    vscode.commands.registerCommand("flutterReference.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:trancongtien.flutter-reference-lens");
    }),
    vscode.commands.registerCommand("flutterReference.showReferences", showLocations),
    vscode.commands.registerCommand("flutterReference.showImplementations", showLocations),
    vscode.commands.registerCommand("flutterReference.showCallers", showLocations),
    vscode.commands.registerCommand("flutterReference.showCallees", showLocations),
    vscode.commands.registerCommand("flutterReference.analyzeChangeImpact", async () => {
      await analyzeChangeImpact(logger);
    }),
    vscode.commands.registerCommand("flutterReference.analyzeDeleteSafety", async () => {
      await analyzeDeleteSafety(logger);
    }),
    vscode.commands.registerCommand("flutterReference.copyAiContext", async () => {
      await copyAiContext(logger);
    }),
    vscode.commands.registerCommand("flutterReference.showDependencyGraph", async () => {
      await showDependencyGraph(context, hierarchy, logger);
    }),
    vscode.commands.registerCommand("flutterReference.showDiagnostics", async () => {
      await showDiagnostics(context, logger, referenceCache, implementationCache);
    }),
    {
      dispose: () => {
        if (refreshTimer) clearTimeout(refreshTimer);
      }
    }
  );
  logger.info("Activated for Dart documents.");
}

async function showLocations(uri: vscode.Uri, position: vscode.Position, locations: vscode.Location[]): Promise<void> {
  await vscode.commands.executeCommand("editor.action.showReferences", uri, position, locations);
}

async function analyzeChangeImpact(logger: Logger): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "dart") {
    await vscode.window.showInformationMessage("Open a Dart file and place the cursor on a symbol first.");
    return;
  }
  const { uri } = editor.document;
  const position = editor.selection.active;
  try {
    const [rawReferences, rawImplementations] = await Promise.all([
      vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        "vscode.executeReferenceProvider",
        uri,
        position
      ),
      vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        "vscode.executeImplementationProvider",
        uri,
        position
      )
    ]);
    const references = normalizeLocations(rawReferences ?? []).filter(
      (location) => !isAtPosition(location, uri, position)
    );
    const implementations = normalizeLocations(rawImplementations ?? []);
    const summary = summarizeImpact(references, implementations);
    const report = [
      "# Change Impact",
      "",
      `Symbol at \`${vscode.workspace.asRelativePath(uri)}:${position.line + 1}:${position.character + 1}\``,
      "",
      `- Direct usages: ${summary.total}`,
      `- Production usages: ${summary.production}`,
      `- Test usages: ${summary.tests}`,
      `- Generated usages: ${summary.generated}`,
      `- Implementations/overrides: ${summary.implementations}`,
      `- Files affected: ${summary.files}`,
      `- Modules affected: ${summary.modules.length}`,
      "",
      "## Modules",
      "",
      ...(summary.modules.length ? summary.modules.map((module) => `- ${module}`) : ["None detected."]),
      "",
      "> Counts reflect the locations visible to the current Dart language service, not external package consumers."
    ].join("\n");
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: report });
    await vscode.window.showTextDocument(document, { preview: true });
  } catch (error) {
    logger.error("Change-impact analysis failed", error);
    await vscode.window.showErrorMessage(
      "Flutter Reference could not analyze this symbol. See the Output panel for details."
    );
  }
}

interface ActiveSymbolEvidence {
  readonly name: string;
  readonly kind: string;
  readonly relativeFile: string;
  readonly line: number;
  readonly column: number;
  readonly references: readonly vscode.Location[];
  readonly implementations: readonly vscode.Location[];
  readonly complete: boolean;
  readonly frameworkSignals: readonly string[];
}

async function collectActiveSymbolEvidence(): Promise<ActiveSymbolEvidence | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "dart") return undefined;
  const position = editor.selection.active;
  const range = editor.document.getWordRangeAtPosition(position);
  const name = range ? editor.document.getText(range) : "unknown";
  const lineText = editor.document.lineAt(position.line).text;
  const frameworkSignals = [
    /@pragma\s*\(\s*['"]vm:entry-point['"]/.test(lineText) ? "@pragma(vm:entry-point)" : undefined,
    /\b(build|initState|dispose|didChangeDependencies|didUpdateWidget)\b/.test(name) ? "Flutter lifecycle" : undefined,
    /MethodChannel|setMethodCallHandler/.test(lineText) ? "MethodChannel callback" : undefined
  ].filter((item): item is string => item !== undefined);

  try {
    const [rawReferences, rawImplementations, hover] = await Promise.all([
      vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        "vscode.executeReferenceProvider",
        editor.document.uri,
        position
      ),
      vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        "vscode.executeImplementationProvider",
        editor.document.uri,
        position
      ),
      vscode.commands.executeCommand<readonly vscode.Hover[]>(
        "vscode.executeHoverProvider",
        editor.document.uri,
        position
      )
    ]);
    return {
      name,
      kind: hover?.length ? "Dart symbol" : "unknown symbol",
      relativeFile: vscode.workspace.asRelativePath(editor.document.uri),
      line: position.line + 1,
      column: position.character + 1,
      references: normalizeLocations(rawReferences ?? []).filter(
        (location) => !isAtPosition(location, editor.document.uri, position)
      ),
      implementations: normalizeLocations(rawImplementations ?? []),
      complete: rawReferences !== undefined && rawImplementations !== undefined,
      frameworkSignals
    };
  } catch {
    return {
      name,
      kind: "unknown symbol",
      relativeFile: vscode.workspace.asRelativePath(editor.document.uri),
      line: position.line + 1,
      column: position.character + 1,
      references: [],
      implementations: [],
      complete: false,
      frameworkSignals
    };
  }
}

async function analyzeDeleteSafety(logger: Logger): Promise<void> {
  try {
    const symbol = await collectActiveSymbolEvidence();
    if (!symbol) {
      await vscode.window.showInformationMessage("Open a Dart file and place the cursor on a symbol first.");
      return;
    }
    const summary = summarizeImpact(symbol.references, symbol.implementations);
    const result = assessDeleteSafety({
      semanticReferences: symbol.references.length,
      implementations: symbol.implementations.length,
      overrides: 0,
      testReferences: summary.tests,
      generatedReferences: summary.generated,
      publicApi: !symbol.name.startsWith("_"),
      frameworkSignals: symbol.frameworkSignals,
      complete: symbol.complete
    });
    const report = [
      "# Delete Safety Analysis",
      "",
      `Symbol: \`${symbol.name}\``,
      `Location: \`${symbol.relativeFile}:${symbol.line}:${symbol.column}\``,
      `Risk: **${result.risk}**`,
      `Recommendation: \`${result.recommendation}\``,
      "",
      "## Evidence",
      "",
      `- Semantic references: ${result.evidence.semanticReferences}`,
      `- Implementations: ${result.evidence.implementations}`,
      `- Test references: ${result.evidence.testReferences}`,
      `- Generated references: ${result.evidence.generatedReferences}`,
      `- Public API: ${result.evidence.publicApi ? "Yes" : "No"}`,
      `- Evidence complete: ${result.evidence.complete ? "Yes" : "No"}`,
      "",
      "## Reasons",
      "",
      ...(result.reasons.length
        ? result.reasons.map((reason) => `- ${reason}`)
        : ["- No conclusive reason available."]),
      ...(result.warnings.length ? ["", "## Warnings", "", ...result.warnings.map((warning) => `- ${warning}`)] : []),
      "",
      "> LOW means candidate for review, not automatic permission to delete. External consumers and dynamic framework wiring may be invisible."
    ].join("\n");
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: report });
    await vscode.window.showTextDocument(document, { preview: true });
  } catch (error) {
    logger.error("Delete-safety analysis failed", error);
    await vscode.window.showErrorMessage("Flutter Reference could not analyze delete safety.");
  }
}

async function copyAiContext(logger: Logger): Promise<void> {
  try {
    const symbol = await collectActiveSymbolEvidence();
    if (!symbol) {
      await vscode.window.showInformationMessage("Open a Dart file and place the cursor on a symbol first.");
      return;
    }
    const summary = summarizeImpact(symbol.references, symbol.implementations);
    const relatedTests = [
      ...new Set(
        symbol.references
          .filter((item) => /(?:^|\/)(?:test|integration_test)\//.test(item.uri.path))
          .map((item) => vscode.workspace.asRelativePath(item.uri))
      )
    ].sort();
    const context = [
      "Flutter Reference semantic context",
      `Symbol: ${symbol.name}`,
      `Location: ${symbol.relativeFile}:${symbol.line}:${symbol.column}`,
      `Semantic references: ${symbol.references.length}`,
      `Implementations/overrides: ${symbol.implementations.length}`,
      `Affected files: ${summary.files}`,
      `Affected modules: ${summary.modules.join(", ") || "none detected"}`,
      `Related tests: ${relatedTests.join(", ") || "none detected"}`,
      `Generated references: ${summary.generated}`,
      `Evidence complete: ${symbol.complete ? "yes" : "no"}`,
      "Safety note: zero semantic references does not by itself prove code is safe to delete."
    ].join("\n");
    await vscode.env.clipboard.writeText(context);
    void vscode.window.showInformationMessage("Flutter Reference AI context copied to clipboard.");
  } catch (error) {
    logger.error("Copy AI context failed", error);
    await vscode.window.showErrorMessage("Flutter Reference could not copy AI context.");
  }
}

async function showDependencyGraph(
  context: vscode.ExtensionContext,
  hierarchy: CallHierarchyService,
  logger: Logger
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "dart") {
    await vscode.window.showInformationMessage("Open a Dart file and place the cursor on a callable symbol first.");
    return;
  }
  try {
    const result = await hierarchy.inspect(editor.document.uri, editor.selection.active);
    if (!result) {
      await vscode.window.showInformationMessage(
        "The Dart language service did not provide call hierarchy for this symbol."
      );
      return;
    }
    const maxNodes = getConfig(editor.document.uri).maxGraphNodes;
    const callers = result.incoming.slice(0, maxNodes).map((call) => call.from);
    const remaining = Math.max(0, maxNodes - callers.length);
    const callees = result.outgoing.slice(0, remaining).map((call) => call.to);
    const panel = vscode.window.createWebviewPanel(
      "flutterReferenceDependencyGraph",
      `Dependency Graph: ${result.root.name}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: false }
    );
    context.subscriptions.push(panel);
    panel.webview.html = graphHtml(
      result.root,
      callers,
      callees,
      result.incoming.length + result.outgoing.length > maxNodes
    );
  } catch (error) {
    logger.error("Dependency graph failed", error);
    await vscode.window.showErrorMessage("Flutter Reference could not build this dependency graph.");
  }
}

function normalizeLocations(items: readonly (vscode.Location | vscode.LocationLink)[]): vscode.Location[] {
  const unique = new Map<string, vscode.Location>();
  for (const item of items) {
    const location =
      "targetUri" in item ? new vscode.Location(item.targetUri, item.targetSelectionRange ?? item.targetRange) : item;
    const key = `${location.uri.toString()}:${location.range.start.line}:${location.range.start.character}:${location.range.end.line}:${location.range.end.character}`;
    unique.set(key, location);
  }
  return [...unique.values()];
}

function isAtPosition(location: vscode.Location, uri: vscode.Uri, position: vscode.Position): boolean {
  return location.uri.toString() === uri.toString() && location.range.contains(position);
}

function graphHtml(
  root: vscode.CallHierarchyItem,
  callers: readonly vscode.CallHierarchyItem[],
  callees: readonly vscode.CallHierarchyItem[],
  truncated: boolean
): string {
  const cards = (items: readonly vscode.CallHierarchyItem[]): string =>
    items.length
      ? items
          .map(
            (item) =>
              `<div class="node">${escapeHtml(item.name)}<small>${escapeHtml(vscode.workspace.asRelativePath(item.uri))}</small></div>`
          )
          .join("")
      : '<div class="empty">None</div>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px}.graph{display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(180px,auto) auto minmax(180px,1fr);gap:20px;align-items:center;min-height:60vh}.column{display:grid;gap:10px}.title{text-transform:uppercase;letter-spacing:.08em;opacity:.7;font-size:12px;margin-bottom:8px}.node{border:1px solid var(--vscode-panel-border);background:var(--vscode-editorWidget-background);padding:12px 14px;border-radius:6px}.root{border:2px solid var(--vscode-focusBorder);font-weight:600;min-width:180px;text-align:center}.node small{display:block;opacity:.65;font-weight:400;margin-top:5px}.arrow{font-size:28px;color:var(--vscode-focusBorder)}.empty{opacity:.55}.note{opacity:.7;margin-top:18px}@media(max-width:800px){.graph{grid-template-columns:1fr}.arrow{transform:rotate(90deg);text-align:center}}</style></head><body><h1>Call dependency graph</h1><div class="graph"><section class="column"><div class="title">Callers</div>${cards(callers)}</section><div class="arrow">→</div><section><div class="node root">${escapeHtml(root.name)}<small>${escapeHtml(vscode.workspace.asRelativePath(root.uri))}</small></div></section><div class="arrow">→</div><section class="column"><div class="title">Callees</div>${cards(callees)}</section></div>${truncated ? '<p class="note">Graph truncated by flutterReference.analysis.maxGraphNodes.</p>' : ""}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function showDiagnostics(
  context: vscode.ExtensionContext,
  logger: Logger,
  references: ReferenceCache<SemanticResult>,
  implementations: ReferenceCache<SemanticResult>
): Promise<void> {
  const dart = vscode.extensions.getExtension("Dart-Code.dart-code");
  const flutter = vscode.extensions.getExtension("Dart-Code.flutter");
  const config = getConfig();
  const workspaceFolders = vscode.workspace.workspaceFolders?.length ?? 0;
  const report = [
    "# Flutter Reference Diagnostics",
    "",
    `- Extension: ${packageVersion(context.extension.packageJSON)}`,
    `- VS Code: ${vscode.version}`,
    `- OS: ${os.platform()} ${os.release()} (${os.arch()})`,
    `- Dart extension: ${dart ? `${packageVersion(dart.packageJSON)} (${dart.isActive ? "active" : "inactive"})` : "not installed"}`,
    `- Flutter extension: ${flutter ? `${packageVersion(flutter.packageJSON)} (${flutter.isActive ? "active" : "inactive"})` : "not installed"}`,
    `- Workspace folders: ${workspaceFolders}`,
    `- Reference cache: ${JSON.stringify(references.stats())}`,
    `- Implementation cache: ${JSON.stringify(implementations.stats())}`,
    `- Configuration: ${JSON.stringify(config, null, 2)}`,
    "",
    "## Recent errors",
    "",
    ...(logger.recentErrors().length ? logger.recentErrors().map((error) => `- ${error}`) : ["None."]),
    "",
    "> This report contains no source code. Review paths or environment data before sharing."
  ].join("\n");
  const document = await vscode.workspace.openTextDocument({ language: "markdown", content: report });
  await vscode.window.showTextDocument(document, { preview: true });
}

function packageVersion(packageJson: unknown): string {
  if (typeof packageJson !== "object" || packageJson === null || !("version" in packageJson)) return "unknown";
  const version = packageJson.version;
  return typeof version === "string" ? version : "unknown";
}

export function deactivate(): void {}
