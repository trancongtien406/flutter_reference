import * as vscode from "vscode";

export const GENERATED_FILE_PATTERN = /(?:\.g|\.freezed|\.gr|\.mocks)\.dart$/i;
export const TEST_PATH_PATTERN = /(?:^|\/)(?:test|integration_test)(?:\/|$)/i;

export function locationKey(location: vscode.Location): string {
  const range = location.range;
  return `${location.uri.toString()}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

export function isDeclaration(location: vscode.Location, declaration: vscode.Location): boolean {
  if (location.uri.toString() !== declaration.uri.toString()) return false;
  return location.range.contains(declaration.range.start) || declaration.range.contains(location.range.start);
}

export function classifyUri(uri: vscode.Uri): "production" | "test" | "generated" {
  const normalizedPath = uri.path.replaceAll("\\", "/");
  if (GENERATED_FILE_PATTERN.test(normalizedPath)) return "generated";
  if (TEST_PATH_PATTERN.test(normalizedPath)) return "test";
  return "production";
}

export function usageLabel(production: number, tests: number, generated: number): string {
  const total = production + tests + generated;
  const usage = `${total} ${total === 1 ? "usage" : "usages"}`;
  if (total > 0 && production === 0 && tests > 0 && generated === 0) return `${usage} · tests only`;
  if (total > 0 && production === 0 && generated > 0 && tests === 0) return `${usage} · generated only`;
  return usage;
}
