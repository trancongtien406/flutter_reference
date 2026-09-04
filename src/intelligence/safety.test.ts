import { describe, expect, it } from "vitest";
import { DeleteSafetyEvidence } from "./contracts";
import { assessDeleteSafety } from "./safety";

const evidence = (overrides: Partial<DeleteSafetyEvidence> = {}): DeleteSafetyEvidence => ({
  semanticReferences: 0,
  implementations: 0,
  overrides: 0,
  testReferences: 0,
  generatedReferences: 0,
  publicApi: false,
  frameworkSignals: [],
  complete: true,
  ...overrides
});

describe("delete safety", () => {
  it("allows only complete, private, disconnected symbols to be LOW risk", () => {
    expect(assessDeleteSafety(evidence())).toMatchObject({
      status: "COMPLETE",
      risk: "LOW",
      recommendation: "candidate_for_removal"
    });
  });

  it("treats incomplete evidence as UNKNOWN", () => {
    expect(assessDeleteSafety(evidence({ complete: false }))).toMatchObject({
      status: "PARTIAL",
      risk: "UNKNOWN",
      recommendation: "manual_review"
    });
  });

  it.each([
    { publicApi: true },
    { implementations: 1 },
    { overrides: 1 },
    { generatedReferences: 1 },
    { frameworkSignals: ["@pragma(vm:entry-point)"] }
  ])("treats safety boundaries as HIGH risk: %o", (change) => {
    expect(assessDeleteSafety(evidence(change))).toMatchObject({ risk: "HIGH", recommendation: "manual_review" });
  });

  it("marks referenced private code for review", () => {
    expect(assessDeleteSafety(evidence({ semanticReferences: 2 }))).toMatchObject({
      risk: "MEDIUM",
      recommendation: "review_recommended"
    });
  });
});
