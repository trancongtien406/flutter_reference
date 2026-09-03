import * as path from "node:path";
import * as vscode from "vscode";
import { classifyUri } from "../core/location";

export interface ImpactSummary {
  readonly total: number;
  readonly production: number;
  readonly tests: number;
  readonly generated: number;
  readonly implementations: number;
  readonly modules: readonly string[];
  readonly files: number;
}

export function moduleForUri(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  const relative = folder ? path.posix.relative(folder.uri.path, uri.path) : uri.path;
  const segments = relative.split("/").filter(Boolean);
  const libIndex = segments.indexOf("lib");
  if (libIndex >= 0 && segments[libIndex + 1]) return segments[libIndex + 1];
  const testIndex = segments.findIndex((segment) => segment === "test" || segment === "integration_test");
  if (testIndex >= 0 && segments[testIndex + 1]) return segments[testIndex + 1];
  return segments.length > 1 ? segments[0] : "root";
}

export function summarizeImpact(
  references: readonly vscode.Location[],
  implementations: readonly vscode.Location[]
): ImpactSummary {
  const modules = new Set(references.map((location) => moduleForUri(location.uri)));
  const files = new Set(references.map((location) => location.uri.toString()));
  return {
    total: references.length,
    production: references.filter((item) => classifyUri(item.uri) === "production").length,
    tests: references.filter((item) => classifyUri(item.uri) === "test").length,
    generated: references.filter((item) => classifyUri(item.uri) === "generated").length,
    implementations: implementations.length,
    modules: [...modules].sort(),
    files: files.size
  };
}
