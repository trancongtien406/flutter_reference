import { DeleteSafetyResult, SourceLocation, SymbolIdentity } from "./contracts";

export type SemanticErrorCode =
  | "SYMBOL_NOT_FOUND"
  | "LANGUAGE_SERVICE_UNAVAILABLE"
  | "WORKSPACE_NOT_INDEXED"
  | "UNSUPPORTED_SYMBOL"
  | "ANALYSIS_TIMEOUT"
  | "INTERNAL_ERROR";

export interface SemanticQuery {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly includeTests?: boolean;
  readonly includeGenerated?: boolean;
  readonly pageSize?: number;
  readonly cursor?: string;
}

export interface SemanticSummary {
  readonly total: number;
  readonly files: number;
  readonly production: number;
  readonly tests: number;
  readonly generated: number;
}

export interface SemanticPage {
  readonly status: "COMPLETE" | "PARTIAL";
  readonly complete: boolean;
  readonly symbol: SymbolIdentity;
  readonly summary: SemanticSummary;
  readonly locations: readonly SourceLocation[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly warnings: readonly string[];
}

export interface SemanticFailure {
  readonly status: "ERROR";
  readonly complete: false;
  readonly code: SemanticErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type SemanticResponse = SemanticPage | SemanticFailure;

export interface SemanticIntelligencePort {
  findReferences(query: SemanticQuery): Promise<SemanticResponse>;
  findImplementations(query: SemanticQuery): Promise<SemanticResponse>;
  analyzeDeleteSafety(query: SemanticQuery): Promise<DeleteSafetyResult | SemanticFailure>;
  analyzeChangeImpact(query: SemanticQuery): Promise<SemanticResponse>;
}
