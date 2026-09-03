import * as vscode from "vscode";
import { FlutterReferenceConfig } from "../core/config";
import { classifyUri, isDeclaration, locationKey } from "../core/location";
import { QueryQueue } from "../core/queryQueue";
import { DartSymbol, SemanticResult } from "../core/types";

export class SemanticService {
  public constructor(private readonly queue: QueryQueue) {}

  public findReferences(
    symbol: DartSymbol,
    config: FlutterReferenceConfig,
    token: vscode.CancellationToken
  ): Promise<SemanticResult | undefined> {
    return this.query("vscode.executeReferenceProvider", symbol, config, token, true);
  }

  public findImplementations(
    symbol: DartSymbol,
    config: FlutterReferenceConfig,
    token: vscode.CancellationToken
  ): Promise<SemanticResult | undefined> {
    return this.query("vscode.executeImplementationProvider", symbol, config, token, false);
  }

  private async query(
    command: string,
    symbol: DartSymbol,
    config: FlutterReferenceConfig,
    token: vscode.CancellationToken,
    excludeDeclaration: boolean
  ): Promise<SemanticResult | undefined> {
    if (token.isCancellationRequested) return undefined;
    return this.queue.run(async () => {
      if (token.isCancellationRequested) return undefined;
      const raw = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        command,
        symbol.uri,
        symbol.selectionRange.start
      );
      if (!raw || token.isCancellationRequested) return undefined;
      const declaration = new vscode.Location(symbol.uri, symbol.selectionRange);
      const deduplicated = new Map<string, vscode.Location>();
      for (const item of raw) {
        const location =
          "targetUri" in item
            ? new vscode.Location(item.targetUri, item.targetSelectionRange ?? item.targetRange)
            : item;
        if (excludeDeclaration && isDeclaration(location, declaration)) continue;
        if (config.excludeGeneratedFiles && classifyUri(location.uri) === "generated") continue;
        deduplicated.set(locationKey(location), location);
      }
      const locations = [...deduplicated.values()];
      return {
        locations,
        productionCount: locations.filter((item) => classifyUri(item.uri) === "production").length,
        testCount: locations.filter((item) => classifyUri(item.uri) === "test").length,
        generatedCount: locations.filter((item) => classifyUri(item.uri) === "generated").length
      };
    });
  }
}
