import { randomBytes, createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import {
  AGENT_PROTOCOL_VERSION,
  BridgeDescriptor,
  BridgeFailure,
  BridgeResponse,
  MAX_BRIDGE_REQUEST_BYTES,
  isBridgeRequest
} from "./bridgeProtocol";

export type BridgeHandler = (method: string, params: unknown) => Promise<unknown>;

export interface BridgeServerOptions {
  readonly workspaceId: string;
  readonly extensionVersion: string;
  readonly descriptorPath: string;
  readonly handler: BridgeHandler;
}

export class AgentBridgeServer {
  private server: net.Server | undefined;
  private descriptor: BridgeDescriptor | undefined;
  private descriptorPath: string | undefined;

  public async start(options: BridgeServerOptions): Promise<BridgeDescriptor> {
    if (this.server) throw new Error("Agent bridge is already running.");
    const token = randomBytes(32).toString("hex");
    const endpoint = bridgeEndpoint(options.workspaceId, token);
    if (process.platform !== "win32") await rm(endpoint, { force: true });
    const server = net.createServer((socket) => this.handleSocket(socket, token, options.handler));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(endpoint, () => {
        server.off("error", reject);
        resolve();
      });
    });
    if (process.platform !== "win32") await chmod(endpoint, 0o600);
    const descriptor: BridgeDescriptor = {
      protocolVersion: AGENT_PROTOCOL_VERSION,
      extensionVersion: options.extensionVersion,
      workspaceId: options.workspaceId,
      endpoint,
      token,
      processId: process.pid,
      createdAt: new Date().toISOString()
    };
    await mkdir(path.dirname(options.descriptorPath), { recursive: true });
    await writeFile(options.descriptorPath, JSON.stringify(descriptor), { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32") await chmod(options.descriptorPath, 0o600);
    this.descriptor = descriptor;
    this.descriptorPath = options.descriptorPath;
    return descriptor;
  }

  public async dispose(): Promise<void> {
    const server = this.server;
    const descriptor = this.descriptor;
    const descriptorPath = this.descriptorPath;
    this.server = undefined;
    this.descriptor = undefined;
    this.descriptorPath = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (descriptor && process.platform !== "win32") await rm(descriptor.endpoint, { force: true });
    if (descriptorPath) await rm(descriptorPath, { force: true });
  }

  private handleSocket(socket: net.Socket, token: string, handler: BridgeHandler): void {
    socket.setTimeout(30_000, () => socket.destroy());
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_BRIDGE_REQUEST_BYTES) {
        socket.end(`${JSON.stringify(failure("unknown", "INVALID_REQUEST", "Request is too large.", false))}\n`);
        return;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const payload = buffer.slice(0, newline);
      buffer = "";
      void this.respond(socket, payload, token, handler);
    });
  }

  private async respond(socket: net.Socket, payload: string, token: string, handler: BridgeHandler): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      socket.end(`${JSON.stringify(failure("unknown", "INVALID_REQUEST", "Request must be valid JSON.", false))}\n`);
      return;
    }
    if (!isBridgeRequest(value)) {
      socket.end(`${JSON.stringify(failure("unknown", "INVALID_REQUEST", "Invalid bridge request.", false))}\n`);
      return;
    }
    if (value.token !== token) {
      socket.end(`${JSON.stringify(failure(value.id, "UNAUTHORIZED", "Invalid session token.", false))}\n`);
      return;
    }
    if (value.protocolVersion !== AGENT_PROTOCOL_VERSION) {
      socket.end(
        `${JSON.stringify(failure(value.id, "PROTOCOL_MISMATCH", "Incompatible protocol version.", false))}\n`
      );
      return;
    }
    let response: BridgeResponse;
    try {
      response = { id: value.id, ok: true, result: await handler(value.method, value.params) };
    } catch (error) {
      response = failure(
        value.id,
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Bridge handler failed.",
        false
      );
    }
    socket.end(`${JSON.stringify(response)}\n`);
  }
}

export async function readBridgeDescriptor(descriptorPath: string): Promise<BridgeDescriptor> {
  return JSON.parse(await readFile(descriptorPath, "utf8")) as BridgeDescriptor;
}

function bridgeEndpoint(workspaceId: string, token: string): string {
  const id = createHash("sha256").update(workspaceId).digest("hex").slice(0, 12);
  const session = token.slice(0, 12);
  return process.platform === "win32"
    ? `\\\\.\\pipe\\flutter-reference-${id}-${session}`
    : path.join(os.tmpdir(), `flutter-reference-${id}-${session}.sock`);
}

function failure(id: string, code: BridgeFailure["error"]["code"], message: string, retryable: boolean): BridgeFailure {
  return { id, ok: false, error: { code, message, retryable } };
}
