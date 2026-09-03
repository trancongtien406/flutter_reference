import * as vscode from "vscode";

export interface DartSymbol {
  readonly name: string;
  readonly kind: vscode.SymbolKind;
  readonly uri: vscode.Uri;
  readonly range: vscode.Range;
  readonly selectionRange: vscode.Range;
  readonly containerKind?: vscode.SymbolKind;
}

export interface SemanticResult {
  readonly locations: readonly vscode.Location[];
  readonly productionCount: number;
  readonly testCount: number;
  readonly generatedCount: number;
}

export interface LensData {
  readonly symbol: DartSymbol;
  readonly documentVersion: number;
}
