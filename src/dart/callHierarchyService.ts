import * as vscode from "vscode";
import { QueryQueue } from "../core/queryQueue";

export interface CallHierarchyResult {
  readonly root: vscode.CallHierarchyItem;
  readonly incoming: readonly vscode.CallHierarchyIncomingCall[];
  readonly outgoing: readonly vscode.CallHierarchyOutgoingCall[];
}

export class CallHierarchyService {
  public constructor(private readonly queue: QueryQueue) {}

  public async inspect(
    uri: vscode.Uri,
    position: vscode.Position,
    token?: vscode.CancellationToken
  ): Promise<CallHierarchyResult | undefined> {
    if (token?.isCancellationRequested) return undefined;
    return this.queue.run(async () => {
      const prepared = await vscode.commands.executeCommand<vscode.CallHierarchyItem | vscode.CallHierarchyItem[]>(
        "vscode.prepareCallHierarchy",
        uri,
        position
      );
      const root = Array.isArray(prepared) ? prepared[0] : prepared;
      if (!root || token?.isCancellationRequested) return undefined;
      const [incoming, outgoing] = await Promise.all([
        vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>("vscode.provideIncomingCalls", root),
        vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>("vscode.provideOutgoingCalls", root)
      ]);
      if (token?.isCancellationRequested) return undefined;
      return { root, incoming: incoming ?? [], outgoing: outgoing ?? [] };
    });
  }
}
