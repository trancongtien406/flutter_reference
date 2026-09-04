import { DeadCodeCluster, SymbolGraphEdge, SymbolGraphNode } from "./contracts";

export class SymbolGraph {
  private readonly nodes = new Map<string, SymbolGraphNode>();
  private readonly outgoing = new Map<string, Set<string>>();

  public constructor(nodes: readonly SymbolGraphNode[], edges: readonly SymbolGraphEdge[]) {
    for (const node of nodes) {
      if (this.nodes.has(node.id)) throw new Error(`Duplicate symbol node: ${node.id}`);
      this.nodes.set(node.id, node);
      this.outgoing.set(node.id, new Set());
    }
    for (const edge of edges) {
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
        throw new Error(`Graph edge references an unknown node: ${edge.from} -> ${edge.to}`);
      }
      this.outgoing.get(edge.from)?.add(edge.to);
    }
  }

  public reachableFrom(rootIds: readonly string[]): ReadonlySet<string> {
    const reachable = new Set<string>();
    const pending = rootIds.filter((id) => this.nodes.has(id));
    while (pending.length > 0) {
      const id = pending.pop();
      if (id === undefined || reachable.has(id)) continue;
      reachable.add(id);
      for (const target of this.outgoing.get(id) ?? []) pending.push(target);
    }
    return reachable;
  }

  public stronglyConnectedComponents(): readonly (readonly string[])[] {
    let nextIndex = 0;
    const index = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const components: string[][] = [];

    const visit = (id: string): void => {
      index.set(id, nextIndex);
      lowLink.set(id, nextIndex);
      nextIndex += 1;
      stack.push(id);
      onStack.add(id);

      for (const target of this.outgoing.get(id) ?? []) {
        if (!index.has(target)) {
          visit(target);
          lowLink.set(id, Math.min(lowLink.get(id) ?? 0, lowLink.get(target) ?? 0));
        } else if (onStack.has(target)) {
          lowLink.set(id, Math.min(lowLink.get(id) ?? 0, index.get(target) ?? 0));
        }
      }

      if (lowLink.get(id) !== index.get(id)) return;
      const component: string[] = [];
      let current: string | undefined;
      do {
        current = stack.pop();
        if (current === undefined) break;
        onStack.delete(current);
        component.push(current);
      } while (current !== id);
      components.push(component.sort());
    };

    for (const id of [...this.nodes.keys()].sort()) if (!index.has(id)) visit(id);
    return components;
  }

  public deadCodeClusters(rootIds: readonly string[]): readonly DeadCodeCluster[] {
    const reachable = this.reachableFrom(rootIds);
    return this.stronglyConnectedComponents()
      .filter((nodeIds) => nodeIds.every((id) => !reachable.has(id)))
      .map((nodeIds, index) => ({ id: `cluster_${index + 1}`, nodeIds, reachable: false }));
  }
}
