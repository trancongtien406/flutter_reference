import * as vscode from "vscode";
import { FlutterReferenceConfig } from "../core/config";
import { DartSymbol } from "../core/types";

export class DartSymbolService {
  public async discover(
    document: vscode.TextDocument,
    config: FlutterReferenceConfig,
    token: vscode.CancellationToken
  ): Promise<DartSymbol[]> {
    if (token.isCancellationRequested) return [];
    const raw = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    );
    if (!raw || token.isCancellationRequested) return [];
    return this.flatten(raw, document).filter((symbol) => this.isEnabled(symbol, config));
  }

  private flatten(
    symbols: readonly (vscode.DocumentSymbol | vscode.SymbolInformation)[],
    document: vscode.TextDocument,
    containerKind?: vscode.SymbolKind
  ): DartSymbol[] {
    const result: DartSymbol[] = [];
    for (const symbol of symbols) {
      // Results crossing the command boundary are structural objects and are
      // not guaranteed to preserve `instanceof DocumentSymbol` identity.
      if ("selectionRange" in symbol && "children" in symbol) {
        result.push({
          name: symbol.name,
          kind: symbol.kind,
          uri: document.uri,
          range: symbol.range,
          selectionRange: this.identifierRange(document, symbol.name, symbol.selectionRange, symbol.range),
          containerKind
        });
        result.push(...this.flatten(symbol.children, document, symbol.kind));
      } else {
        result.push({
          name: symbol.name,
          kind: symbol.kind,
          uri: symbol.location.uri,
          range: symbol.location.range,
          selectionRange:
            symbol.location.uri.toString() === document.uri.toString()
              ? this.identifierRange(document, symbol.name, symbol.location.range, symbol.location.range)
              : symbol.location.range,
          containerKind
        });
      }
    }
    return result;
  }

  private identifierRange(
    document: vscode.TextDocument,
    symbolName: string,
    selectionRange: vscode.Range,
    fullRange: vscode.Range
  ): vscode.Range {
    const nameWithoutParameters = symbolName.split("(", 1)[0].trim();
    const simpleName = nameWithoutParameters.split(/[.\s]+/).at(-1) ?? nameWithoutParameters;
    for (const range of [selectionRange, fullRange]) {
      const text = document.getText(range);
      const escaped = simpleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`).exec(text);
      if (!match) continue;
      const start = document.positionAt(document.offsetAt(range.start) + match.index);
      return new vscode.Range(start, document.positionAt(document.offsetAt(start) + simpleName.length));
    }
    return selectionRange;
  }

  private isEnabled(symbol: DartSymbol, config: FlutterReferenceConfig): boolean {
    switch (symbol.kind) {
      case vscode.SymbolKind.Class:
        return config.showClasses;
      case vscode.SymbolKind.Interface:
        return config.showExtensions;
      case vscode.SymbolKind.Constructor:
        return config.showConstructors;
      case vscode.SymbolKind.Method:
        return config.showMethods;
      case vscode.SymbolKind.Function:
        return config.showFunctions;
      case vscode.SymbolKind.Field:
        return config.showFields;
      case vscode.SymbolKind.Property:
        return config.showGettersSetters;
      case vscode.SymbolKind.Variable:
      case vscode.SymbolKind.Constant:
        return config.showVariables;
      case vscode.SymbolKind.Enum:
        return config.showEnums;
      case vscode.SymbolKind.EnumMember:
        return config.showEnumMembers;
      default:
        return false;
    }
  }
}
