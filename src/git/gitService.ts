import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";

const execFileAsync = promisify(execFile);

export class GitService {
  public async changedAgo(uri: vscode.Uri, line: number): Promise<string | undefined> {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder || uri.scheme !== "file") return undefined;
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["blame", "--line-porcelain", "-L", `${line + 1},${line + 1}`, "--", uri.fsPath],
        { cwd: folder.uri.fsPath, timeout: 3_000, maxBuffer: 128 * 1024 }
      );
      const match = /^author-time (\d+)$/m.exec(stdout);
      if (!match) return undefined;
      return relativeAge(Number(match[1]) * 1_000, Date.now());
    } catch {
      return undefined;
    }
  }
}

export function relativeAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 60) return "changed just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `changed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `changed ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `changed ${days}d ago`;
  return `changed ${Math.floor(days / 365)}y ago`;
}
