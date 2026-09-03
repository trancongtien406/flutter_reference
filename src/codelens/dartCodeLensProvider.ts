import * as vscode from "vscode";
import { ReferenceCache } from "../cache/referenceCache";
import { getConfig } from "../core/config";
import { usageLabel } from "../core/location";
import { Logger } from "../core/logger";
import { DartSymbol, LensData, SemanticResult } from "../core/types";
import { SemanticService } from "../dart/semanticService";
import { DartSymbolService } from "../dart/symbolService";
import { CallHierarchyResult, CallHierarchyService } from "../dart/callHierarchyService";
import { GitService } from "../git/gitService";

type LensType = "references" | "implementations" | "callers" | "callees";

class DartCodeLens extends vscode.CodeLens {
  public constructor(
    range: vscode.Range,
    public readonly data: LensData,
    public readonly type: LensType
  ) {
    super(range);
  }
}

export class DartReferenceCodeLensProvider implements vscode.CodeLensProvider<DartCodeLens>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.emitter.event;

  public constructor(
    private readonly symbols: DartSymbolService,
    private readonly semantics: SemanticService,
    private readonly hierarchy: CallHierarchyService,
    private readonly referenceCache: ReferenceCache<SemanticResult>,
    private readonly implementationCache: ReferenceCache<SemanticResult>,
    private readonly hierarchyCache: ReferenceCache<CallHierarchyResult>,
    private readonly gitCache: ReferenceCache<string>,
    private readonly git: GitService,
    private readonly logger: Logger
  ) {}

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<DartCodeLens[]> {
    const config = getConfig(document.uri);
    if (!config.enabled || document.languageId !== "dart") return [];
    let symbols: DartSymbol[];
    try {
      symbols = await this.symbols.discover(document, config, token);
    } catch (error) {
      this.logger.error(`Could not discover symbols for ${document.uri.toString()}`, error);
      return [];
    }
    return symbols.flatMap((symbol) => {
      const data = { symbol, documentVersion: document.version };
      const lenses = [new DartCodeLens(symbol.selectionRange, data, "references")];
      if (config.showImplementations && this.canHaveImplementations(symbol)) {
        lenses.push(new DartCodeLens(symbol.selectionRange, data, "implementations"));
      }
      if (config.showCallHierarchy && this.canHaveCalls(symbol)) {
        lenses.push(new DartCodeLens(symbol.selectionRange, data, "callers"));
        lenses.push(new DartCodeLens(symbol.selectionRange, data, "callees"));
      }
      return lenses;
    });
  }

  public async resolveCodeLens(lens: DartCodeLens, token: vscode.CancellationToken): Promise<DartCodeLens> {
    const document = vscode.workspace.textDocuments.find(
      (item) => item.uri.toString() === lens.data.symbol.uri.toString()
    );
    if (document && document.version !== lens.data.documentVersion) return lens;
    const config = getConfig(lens.data.symbol.uri);
    const key = this.cacheKey(lens.data.symbol, lens.data.documentVersion, config.excludeGeneratedFiles);
    if (lens.type === "callers" || lens.type === "callees")
      return this.resolveHierarchyLens(lens, key, config.cacheEnabled, token);
    const cache = lens.type === "references" ? this.referenceCache : this.implementationCache;
    let result = config.cacheEnabled ? cache.get(key) : undefined;
    try {
      result ??=
        lens.type === "references"
          ? await this.semantics.findReferences(lens.data.symbol, config, token)
          : await this.semantics.findImplementations(lens.data.symbol, config, token);
    } catch (error) {
      this.logger.error(`Could not resolve ${lens.type} for ${lens.data.symbol.name}`, error);
      return lens;
    }
    if (!result || token.isCancellationRequested) return lens;
    if (config.cacheEnabled) cache.set(key, result);
    const count = result.locations.length;
    if (lens.type === "references") {
      if (count === 0 && !config.showZeroUsages) return lens;
      let gitContext = "";
      if (config.showGitContext) {
        const gitKey = `${lens.data.symbol.uri.toString()}#${lens.data.symbol.selectionRange.start.line}`;
        let age = this.gitCache.get(gitKey);
        age ??= await this.git.changedAgo(lens.data.symbol.uri, lens.data.symbol.selectionRange.start.line);
        if (age) {
          this.gitCache.set(gitKey, age);
          gitContext = ` · ${age}`;
        }
      }
      lens.command = {
        title: `${usageLabel(result.productionCount, result.testCount, result.generatedCount)}${config.showReferenceHeat && count >= config.referenceHeatThreshold ? " · high impact" : ""}${gitContext}`,
        command: "flutterReference.showReferences",
        arguments: [lens.data.symbol.uri, lens.data.symbol.selectionRange.start, result.locations],
        tooltip: `${result.productionCount} production · ${result.testCount} test · ${result.generatedCount} generated`
      };
    } else if (count > 0) {
      lens.command = {
        title:
          lens.data.symbol.kind === vscode.SymbolKind.Method
            ? `overridden by ${count}`
            : `${count} ${count === 1 ? "implementation" : "implementations"}`,
        command: "flutterReference.showImplementations",
        arguments: [lens.data.symbol.uri, lens.data.symbol.selectionRange.start, result.locations]
      };
    }
    return lens;
  }

  public refresh(): void {
    this.emitter.fire();
  }
  public dispose(): void {
    this.emitter.dispose();
  }

  private cacheKey(symbol: DartSymbol, version: number, excludeGenerated: boolean): string {
    const start = symbol.selectionRange.start;
    return `${symbol.uri.toString()}#${start.line}:${start.character}:${symbol.kind}:${version}:${excludeGenerated}`;
  }

  private canHaveImplementations(symbol: DartSymbol): boolean {
    return [vscode.SymbolKind.Class, vscode.SymbolKind.Interface, vscode.SymbolKind.Method].includes(symbol.kind);
  }

  private canHaveCalls(symbol: DartSymbol): boolean {
    return [vscode.SymbolKind.Method, vscode.SymbolKind.Function, vscode.SymbolKind.Constructor].includes(symbol.kind);
  }

  private async resolveHierarchyLens(
    lens: DartCodeLens,
    key: string,
    cacheEnabled: boolean,
    token: vscode.CancellationToken
  ): Promise<DartCodeLens> {
    let result = cacheEnabled ? this.hierarchyCache.get(key) : undefined;
    try {
      result ??= await this.hierarchy.inspect(lens.data.symbol.uri, lens.data.symbol.selectionRange.start, token);
    } catch (error) {
      this.logger.error(`Could not resolve call hierarchy for ${lens.data.symbol.name}`, error);
      return lens;
    }
    if (!result || token.isCancellationRequested) return lens;
    if (cacheEnabled) this.hierarchyCache.set(key, result);
    const locations =
      lens.type === "callers"
        ? result.incoming.map((call) => new vscode.Location(call.from.uri, call.from.selectionRange))
        : result.outgoing.map((call) => new vscode.Location(call.to.uri, call.to.selectionRange));
    if (locations.length === 0) return lens;
    const singular = lens.type === "callers" ? "caller" : "callee";
    lens.command = {
      title: `${locations.length} ${locations.length === 1 ? singular : `${singular}s`}`,
      command: lens.type === "callers" ? "flutterReference.showCallers" : "flutterReference.showCallees",
      arguments: [lens.data.symbol.uri, lens.data.symbol.selectionRange.start, locations]
    };
    return lens;
  }
}
