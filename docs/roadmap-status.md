# Roadmap status

Status as of 2026-09-03. “Implemented” means source and automated checks exist. Platform/publishing rows remain external validation because they require infrastructure or account ownership not present in this workspace.

| Phase                       | Status                                       | Evidence                                                                          |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| 0 Research/spike            | Implemented and runtime-verified             | Technical spike and Extension Host integration suite                              |
| 1 Bootstrap                 | Implemented                                  | Manifest, commands, logging, Dart-only activation                                 |
| 2 Symbol discovery          | Implemented                                  | Structural hierarchy flattening, identifier normalization, full fixture           |
| 3 Reference engine          | Implemented                                  | Semantic provider, declaration exclusion, deduplication, classification           |
| 4 CodeLens MVP              | Implemented                                  | Lazy unresolved/resolved lens pipeline                                            |
| 5 Navigation                | Implemented                                  | Native Peek References                                                            |
| 6 Dart coverage             | Implemented to provider capability           | All stable symbol kinds plus mixin/extension/typedef fixtures                     |
| 7 Cache/performance         | Implemented and regression-tested            | Cache, invalidation, debounce, queue, cancellation, 120-method budget             |
| 8 Implementations/hierarchy | Implemented                                  | Implementations/overrides and optional callers/callees                            |
| 9 Code health               | Implemented                                  | Zero usages, tests-only, generated-only, breakdown tooltip                        |
| 10 Testing                  | Implemented locally                          | Unit, coverage, Dart analyze, VS Code/Dart-Code integration; three-OS CI prepared |
| 11 UX/settings              | Implemented                                  | Settings, commands, diagnostics, noise controls                                   |
| 12 Packaging                | VSIX complete; publishing pending owner      | Icon, README, changelog, license, workflow, VSIX                                  |
| 13 Hardening                | Automation complete; external matrix pending | macOS ARM64 verified; CI covers Linux/macOS/Windows after push                    |
| 14 Advanced                 | Implemented                                  | Heat, impact, modules, test relationship, Git age, call graph                     |

## Roadmap v2: AI-agent intelligence

| Phase                   | Status                | Evidence                                                                                                                                                                                          |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0 Core extraction      | In progress           | VS Code-independent contracts, source classification, semantic port, delete-safety policy, and graph algorithms added under `src/intelligence`; semantic provider adapters still use VS Code APIs |
| A1 Agent primitives     | In progress           | Structured contracts and authenticated local IPC transport are implemented; semantic method dispatch is pending                                                                                   |
| A2 MCP v0.1             | In progress           | Extension lifecycle now owns a versioned local bridge; MCP stdio adapter and semantic method dispatch remain pending                                                                               |
| A3 Context intelligence | Partially implemented | `Copy AI Context` returns references, implementations, modules, generated relationships, and related tests locally                                                                                |
| A4 Verification         | Pending               | Requires explicit analyzer and related-test execution scopes                                                                                                                                      |
| A5 Symbol graph         | In progress           | Typed edges, reachability, Tarjan SCC, and dead-cluster detection are unit-tested; workspace indexing is pending                                                                                  |
| A6 Dead-code clusters   | In progress           | Core graph algorithm exists; application-root and framework adapters are pending                                                                                                                  |
| A7 Framework rules      | In progress           | Conservative Flutter lifecycle, entry-point pragma, and MethodChannel risk signals exist                                                                                                          |
| A8 CLI + CI             | Pending               | No grep-based substitute will be shipped as semantic analysis                                                                                                                                     |
| A9 Safe Delete UX       | In progress           | Read-only `Analyze Delete Safety` evidence report exists; no automatic deletion                                                                                                                   |
| A10 Agentic refactor    | Pending               | Intentionally blocked until analysis and verification are production-proven                                                                                                                       |

## External actions still required

1. Confirm the pushed GitHub Actions matrix passes on all three operating systems.
2. Add Marketplace credentials as `VSCE_PAT` or configure Microsoft Entra publishing.
3. Capture truthful GIF/screenshots from the owner’s chosen theme and project.
4. Dogfood on a production Flutter project and record the 500/1,000/3,000-file measurements.

No source feature is represented as platform-verified or published before those actions happen.
