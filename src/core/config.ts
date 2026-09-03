import * as vscode from "vscode";

export interface FlutterReferenceConfig {
  readonly enabled: boolean;
  readonly showClasses: boolean;
  readonly showConstructors: boolean;
  readonly showMethods: boolean;
  readonly showFunctions: boolean;
  readonly showFields: boolean;
  readonly showGettersSetters: boolean;
  readonly showVariables: boolean;
  readonly showEnums: boolean;
  readonly showEnumMembers: boolean;
  readonly showExtensions: boolean;
  readonly showZeroUsages: boolean;
  readonly showImplementations: boolean;
  readonly showCallHierarchy: boolean;
  readonly showReferenceHeat: boolean;
  readonly referenceHeatThreshold: number;
  readonly showGitContext: boolean;
  readonly excludeGeneratedFiles: boolean;
  readonly cacheEnabled: boolean;
  readonly maxConcurrentQueries: number;
  readonly refreshDebounceMs: number;
  readonly maxGraphNodes: number;
  readonly debugLogging: boolean;
}

export function getConfig(uri?: vscode.Uri): FlutterReferenceConfig {
  const config = vscode.workspace.getConfiguration("flutterReference", uri);
  return {
    enabled: config.get("enabled", true),
    showClasses: config.get("showClasses", true),
    showConstructors: config.get("showConstructors", true),
    showMethods: config.get("showMethods", true),
    showFunctions: config.get("showFunctions", true),
    showFields: config.get("showFields", false),
    showGettersSetters: config.get("showGettersSetters", true),
    showVariables: config.get("showVariables", false),
    showEnums: config.get("showEnums", true),
    showEnumMembers: config.get("showEnumMembers", false),
    showExtensions: config.get("showExtensions", true),
    showZeroUsages: config.get("showZeroUsages", true),
    showImplementations: config.get("showImplementations", true),
    showCallHierarchy: config.get("showCallHierarchy", false),
    showReferenceHeat: config.get("showReferenceHeat", false),
    referenceHeatThreshold: config.get("referenceHeatThreshold", 50),
    showGitContext: config.get("showGitContext", false),
    excludeGeneratedFiles: config.get("excludeGeneratedFiles", true),
    cacheEnabled: config.get("cache.enabled", true),
    maxConcurrentQueries: config.get("performance.maxConcurrentQueries", 4),
    refreshDebounceMs: config.get("performance.refreshDebounceMs", 500),
    maxGraphNodes: config.get("analysis.maxGraphNodes", 100),
    debugLogging: config.get("debugLogging", false)
  };
}
