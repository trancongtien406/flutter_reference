import { describe, expect, it } from "vitest";
import { SymbolGraph } from "./graph";

const nodes = ["main", "live", "legacyA", "legacyB"].map((id) => ({ id, name: id, kind: "function" }));

describe("symbol graph", () => {
  it("finds reachable nodes and mutually-referencing dead clusters", () => {
    const graph = new SymbolGraph(nodes, [
      { from: "main", to: "live", kind: "CALLS" },
      { from: "legacyA", to: "legacyB", kind: "CALLS" },
      { from: "legacyB", to: "legacyA", kind: "CALLS" }
    ]);
    expect([...graph.reachableFrom(["main"])]).toEqual(["main", "live"]);
    expect(graph.deadCodeClusters(["main"])).toEqual([
      { id: "cluster_1", nodeIds: ["legacyA", "legacyB"], reachable: false }
    ]);
  });

  it("rejects edges with missing semantic identities", () => {
    expect(() => new SymbolGraph(nodes, [{ from: "main", to: "missing", kind: "CALLS" }])).toThrow("unknown node");
  });
});
