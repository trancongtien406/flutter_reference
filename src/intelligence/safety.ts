import { DeleteSafetyEvidence, DeleteSafetyResult } from "./contracts";

export function assessDeleteSafety(evidence: DeleteSafetyEvidence): DeleteSafetyResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!evidence.complete) {
    warnings.push("Semantic evidence is incomplete; LOW risk is not permitted.");
    return {
      status: "PARTIAL",
      risk: "UNKNOWN",
      recommendation: "manual_review",
      reasons,
      warnings,
      evidence
    };
  }

  if (evidence.semanticReferences === 0) reasons.push("No semantic references found.");
  else reasons.push(`${evidence.semanticReferences} semantic reference(s) found.`);
  if (!evidence.publicApi) reasons.push("Symbol is not exposed as a public Dart API.");

  const highRiskReasons: string[] = [];
  if (evidence.publicApi) highRiskReasons.push("Symbol may be consumed as public API outside this workspace.");
  if (evidence.frameworkSignals.length > 0) {
    highRiskReasons.push(`Framework-driven usage signal(s): ${evidence.frameworkSignals.join(", ")}.`);
  }
  if (evidence.implementations > 0 || evidence.overrides > 0) {
    highRiskReasons.push("Symbol participates in an implementation or override contract.");
  }
  if (evidence.generatedReferences > 0) highRiskReasons.push("Generated-code relationships were found.");

  if (highRiskReasons.length > 0) {
    return {
      status: "COMPLETE",
      risk: "HIGH",
      recommendation: "manual_review",
      reasons: [...reasons, ...highRiskReasons],
      warnings,
      evidence
    };
  }

  if (evidence.semanticReferences === 0 && evidence.testReferences === 0) {
    return {
      status: "COMPLETE",
      risk: "LOW",
      recommendation: "candidate_for_removal",
      reasons,
      warnings,
      evidence
    };
  }

  return {
    status: "COMPLETE",
    risk: "MEDIUM",
    recommendation: "review_recommended",
    reasons,
    warnings,
    evidence
  };
}
