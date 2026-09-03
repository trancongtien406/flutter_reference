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

## External actions still required

1. Confirm the pushed GitHub Actions matrix passes on all three operating systems.
2. Add Marketplace credentials as `VSCE_PAT` or configure Microsoft Entra publishing.
3. Capture truthful GIF/screenshots from the owner’s chosen theme and project.
4. Dogfood on a production Flutter project and record the 500/1,000/3,000-file measurements.

No source feature is represented as platform-verified or published before those actions happen.
