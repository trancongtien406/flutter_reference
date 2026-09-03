# Technical spike

## Decision

Use the stable VS Code language-feature commands supplied by the official Dart extension:

- `vscode.executeDocumentSymbolProvider` for discovery.
- `vscode.executeReferenceProvider` for semantic references.
- `vscode.executeImplementationProvider` for implementations.
- `editor.action.showReferences` for native preview/navigation.

This keeps Flutter Reference independent from private Dart-Code APIs and avoids a second analysis server or textual search.

## Result shapes and normalization

Document discovery may return hierarchical `DocumentSymbol` values or flat `SymbolInformation` values. The implementation accepts both and recursively flattens hierarchy. Reference and implementation commands may return `Location` or `LocationLink`; both are normalized to `Location`.

Reference providers can include the declaration. Flutter Reference excludes any result in the declaration URI whose range contains the declaration start (or vice versa), then deduplicates using URI and exact range. Generated sources are classified after normalization.

## Confirmed API behavior

The commands and provider contracts are part of VS Code's stable API. Dart-Code publicly advertises document symbols, find references, and type hierarchy support. Actual symbol-kind granularity and cross-package results remain controlled by the installed Dart SDK/Dart-Code version.

The integration run on 2026-09-03 used VS Code 1.136.0 and Dart-Code 3.142.0. It exposed two important command-boundary behaviors:

- `DocumentSymbol` values must be recognized structurally; `instanceof` loses nested methods after command serialization.
- Some selection ranges cover a signature rather than only its identifier. Querying at `selectionRange.start` can target a return type and produce wildly incorrect counts. Flutter Reference locates the declared identifier inside the semantic range before querying.

## Runtime matrix

The included fixture covers duplicate method names, top-level functions, constructors, getters/setters, enum values, mixins, extensions, typedefs, abstract implementations, private symbols, and test-only calls. The automated Extension Host suite verifies activation, nested discovery, usage counts, implementations, duplicate method isolation, test references, caching, and a 120-method performance fixture.

The following cannot truthfully be certified by a source-only spike and remain release validation work:

- exact behavior across every supported Dart-Code/Dart SDK combination;
- generated-code and files outside the workspace;
- monorepo/Melos/symlink behavior;
- Windows and Linux UI behavior;
- performance on 500, 1,000, and 3,000+ Dart-file workspaces.

## Failure policy

When the semantic provider is unavailable, cancelled, or returns no result object, the lens remains unresolved. Correctness takes priority over displaying a number. A successful empty array is displayed as `0 usages`, with documentation warning that this does not establish dead code.

## Sources

- [VS Code built-in commands](https://code.visualstudio.com/api/references/commands)
- [VS Code extension anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [VS Code activation events](https://code.visualstudio.com/api/references/activation-events)
- [Dart-Code repository](https://github.com/Dart-Code/Dart-Code)
