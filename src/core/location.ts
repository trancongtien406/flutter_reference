import * as vscode from "vscode";
import { classifySourcePath, SourceClassification } from "../intelligence/classification";

export function locationKey(location: vscode.Location): string {
  const range = location.range;
  return `${location.uri.toString()}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

export function isDeclaration(location: vscode.Location, declaration: vscode.Location): boolean {
  if (location.uri.toString() !== declaration.uri.toString()) return false;
  return location.range.contains(declaration.range.start) || declaration.range.contains(location.range.start);
}

export function classifyUri(uri: vscode.Uri): SourceClassification {
  return classifySourcePath(uri.path);
}

export function usageLabel(production: number, tests: number, generated: number): string {
  const total = production + tests + generated;
  const usage = `${total} ${total === 1 ? "usage" : "usages"}`;
  if (total > 0 && production === 0 && tests > 0 && generated === 0) return `${usage} · tests only`;
  if (total > 0 && production === 0 && generated > 0 && tests === 0) return `${usage} · generated only`;
  return usage;
}
