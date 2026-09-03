import * as vscode from "vscode";
import { getConfig } from "./config";

export class Logger implements vscode.Disposable {
  public readonly output = vscode.window.createOutputChannel("Flutter Reference", { log: true });
  private readonly errors: string[] = [];

  public debug(message: string): void {
    if (getConfig().debugLogging) this.output.debug(message);
  }
  public info(message: string): void {
    this.output.info(message);
  }
  public error(message: string, error?: unknown): void {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === "string"
          ? error
          : error === undefined || error === null
            ? ""
            : "Unknown error";
    const safe = `${message}${detail ? ` — ${detail}` : ""}`;
    this.errors.push(safe);
    if (this.errors.length > 20) this.errors.shift();
    this.output.error(safe);
  }
  public recentErrors(): readonly string[] {
    return this.errors;
  }
  public dispose(): void {
    this.output.dispose();
  }
}
