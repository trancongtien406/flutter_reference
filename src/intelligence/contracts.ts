export type IntelligenceStatus = "COMPLETE" | "PARTIAL" | "ERROR";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type Recommendation = "candidate_for_removal" | "review_recommended" | "manual_review";

export interface SourceLocation {
  readonly uri: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export interface SymbolIdentity {
  readonly name: string;
  readonly kind: string;
  readonly declaration: SourceLocation;
}

export interface DeleteSafetyEvidence {
  readonly semanticReferences: number;
  readonly implementations: number;
  readonly overrides: number;
  readonly testReferences: number;
  readonly generatedReferences: number;
  readonly publicApi: boolean;
  readonly frameworkSignals: readonly string[];
  readonly complete: boolean;
}

export interface DeleteSafetyResult {
  readonly status: IntelligenceStatus;
  readonly risk: RiskLevel;
  readonly recommendation: Recommendation;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly evidence: DeleteSafetyEvidence;
}

export type SymbolEdgeKind =
  | "REFERENCES"
  | "CALLS"
  | "IMPLEMENTS"
  | "EXTENDS"
  | "OVERRIDES"
  | "IMPORTS"
  | "EXPORTS"
  | "TESTS"
  | "GENERATED_FROM"
  | "REGISTERED_BY";

export interface SymbolGraphNode {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

export interface SymbolGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SymbolEdgeKind;
}

export interface DeadCodeCluster {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly reachable: boolean;
}
