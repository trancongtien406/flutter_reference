import * as os from "node:os";
import * as path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { callAgentBridge } from "./bridgeClient";
import { AgentBridgeServer } from "./bridgeServer";

const servers: AgentBridgeServer[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.dispose()));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("authenticated agent bridge", () => {
  it("round-trips a local semantic request", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "flutter-reference-test-"));
    directories.push(directory);
    const descriptorPath = path.join(directory, "bridge.json");
    const server = new AgentBridgeServer();
    servers.push(server);
    const descriptor = await server.start({
      workspaceId: directory,
      extensionVersion: "1.1.0",
      descriptorPath,
      handler: (method, params) => Promise.resolve({ method, params })
    });

    const response = await callAgentBridge(descriptor, "dart_find_references", { file: "lib/a.dart" });
    expect(response).toMatchObject({
      ok: true,
      result: { method: "dart_find_references", params: { file: "lib/a.dart" } }
    });
    expect(JSON.parse(await readFile(descriptorPath, "utf8"))).toMatchObject({ protocolVersion: 1 });
    if (process.platform !== "win32") expect((await stat(descriptorPath)).mode & 0o777).toBe(0o600);
  });

  it("rejects an invalid token", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "flutter-reference-test-"));
    directories.push(directory);
    const server = new AgentBridgeServer();
    servers.push(server);
    const descriptor = await server.start({
      workspaceId: directory,
      extensionVersion: "1.1.0",
      descriptorPath: path.join(directory, "bridge.json"),
      handler: () => Promise.resolve({})
    });
    const response = await callAgentBridge({ ...descriptor, token: "wrong" }, "test", {});
    expect(response).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
});
