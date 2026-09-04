# Architecture V2: Extension-first, agent-ready

## Product boundary

Flutter Reference remains a single installable editor extension. The VSIX carries three consumers of one semantic core:

```text
Flutter Reference VSIX
├── VS Code extension UI
├── Semantic Intelligence Core
├── local MCP executable
└── local CLI executable
```

Installing the extension does not silently modify an AI host configuration or start a permanent background service. The user explicitly runs a configuration command for each host. Removal of the extension removes the bundled executables; generated host configuration can be removed with a dedicated command.

## Runtime architecture

```text
Cursor / Claude / another MCP host
              │ stdio MCP
              ▼
      bundled MCP process
              │ authenticated local IPC
              ▼
   Flutter Reference Extension Host
              │ VS Code semantic commands
              ▼
       Dart Analysis Server
```

The CLI uses the same local IPC contract. It does not duplicate reference, hierarchy, graph, or safety algorithms.

When the Extension Host is unavailable, the MCP/CLI returns `LANGUAGE_SERVICE_UNAVAILABLE`. It must never replace a failed semantic query with text search or an empty successful result.

## Packages

The migration target is a workspace with explicit dependency direction:

```text
packages/
├── core/                 # portable contracts, graph, safety, pagination
├── vscode-adapter/       # VS Code and Dart language-provider bridge
├── vscode-extension/     # CodeLens, commands, UX, lifecycle
├── agent-bridge/         # authenticated local IPC server/client
├── mcp-server/           # validation and MCP serialization only
└── cli/                  # human/CI command adapter only
```

Dependency rule:

```text
extension ─┐
mcp ───────┼─→ core
cli ───────┘

vscode-adapter → core
agent-bridge   → core
```

`core` cannot import `vscode`, MCP SDK, filesystem, process, network, or UI modules. Host adapters convert their native locations into portable `SourceLocation` values.

## Agent contract

Every tool response is summary-first and bounded:

```json
{
  "status": "COMPLETE",
  "summary": {
    "references": 124,
    "files": 38,
    "risk": "HIGH"
  },
  "locations": [],
  "hasMore": true,
  "nextCursor": "opaque-token",
  "warnings": []
}
```

Defaults:

- no source bodies;
- at most 20 locations per page;
- deterministic ordering;
- opaque pagination cursor bound to the query and workspace revision;
- evidence and completeness always present for safety decisions;
- incomplete evidence can never produce `LOW` risk.

The initial tools are:

1. `dart_find_references`
2. `dart_find_implementations`
3. `dart_find_unused_symbols`
4. `dart_analyze_delete_safety`
5. `dart_analyze_change_impact`
6. `dart_get_symbol_context`
7. `dart_find_related_tests`
8. `dart_verify_change`

## IPC and security

The Extension Host creates a per-session endpoint:

- Unix domain socket on macOS/Linux;
- named pipe on Windows;
- descriptor stored in extension global storage with owner-only permissions;
- random session token required on every request;
- workspace identity and protocol version included in the handshake;
- request size, concurrency, and timeout limits enforced;
- read-only analysis methods enabled by default;
- no source upload, network listener, telemetry containing source, arbitrary shell, or deletion API.

The MCP process receives only the descriptor path and workspace identifier. Tokens are not written into project files or AI prompts.

## Configuration UX

Commands:

```text
Flutter Reference: Configure MCP for Cursor
Flutter Reference: Configure MCP for Claude Code
Flutter Reference: Copy MCP Configuration
Flutter Reference: Check Agent Integration
Flutter Reference: Remove Agent Integration
```

Before writing a host configuration, the extension previews the exact file and JSON change and asks for confirmation. Existing unrelated servers are preserved. Project-local configuration is preferred so the server only receives the intended workspace.

## Availability states

```text
DISABLED
STARTING
WAITING_FOR_DART
READY
STALE
ERROR
```

MCP tool calls received outside `READY` return a typed partial/error result. The agent description instructs the host to retry only `WAITING_FOR_DART` and `STALE`, with a finite timeout.

## Packaging and versioning

The VSIX is the canonical distribution. MCP and CLI artifacts are bundled under `dist/agent/` and use the extension version. The handshake rejects incompatible protocol major versions and reports both versions.

Release verification must cover:

- VSIX install and removal;
- MCP initialize, tools/list, and every tools/call schema;
- Cursor configuration round-trip;
- Windows named pipe and Unix socket transport;
- clean failure when Dart or the Extension Host is unavailable;
- no source code in logs or default tool responses.

Standalone npm packages can be added later for CI, but they are not required for the one-install editor experience.
