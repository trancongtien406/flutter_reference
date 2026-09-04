import * as net from "node:net";
import { randomUUID } from "node:crypto";
import { AGENT_PROTOCOL_VERSION, BridgeDescriptor, BridgeResponse } from "./bridgeProtocol";

export async function callAgentBridge(
  descriptor: BridgeDescriptor,
  method: string,
  params: unknown,
  timeoutMs = 30_000
): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(descriptor.endpoint);
    const id = randomUUID();
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Agent bridge request timed out."));
    }, timeoutMs);
    socket.setEncoding("utf8");
    socket.once("connect", () => {
      socket.write(
        `${JSON.stringify({
          id,
          protocolVersion: AGENT_PROTOCOL_VERSION,
          token: descriptor.token,
          method,
          params
        })}\n`
      );
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timer);
      socket.end();
      resolve(JSON.parse(buffer.slice(0, newline)) as BridgeResponse);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
