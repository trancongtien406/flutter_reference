import * as os from "node:os";
import * as vscode from "vscode";
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

export function activate(context: vscode.ExtensionContext): void {
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
  let refreshTimer: NodeJS.Timeout | undefined;

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
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:trancongtien.flutter-reference");
    }),
    vscode.commands.registerCommand("flutterReference.showReferences", showLocations),
    vscode.commands.registerCommand("flutterReference.showImplementations", showLocations),
    vscode.commands.registerCommand("flutterReference.showCallers", showLocations),
    vscode.commands.registerCommand("flutterReference.showCallees", showLocations),
    vscode.commands.registerCommand("flutterReference.analyzeChangeImpact", async () => {
      await analyzeChangeImpact(logger);
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
