# Flutter Reference

Flutter Reference adds semantic usage and implementation CodeLens to Dart and Flutter files in VS Code.

```dart
// 18 usages | 2 implementations
abstract class ProductRepository {
  // 7 usages | 2 implementations
  Future<List<Product>> getProducts();
}
```

Counts come from the Dart language service through VS Code's semantic providers. The extension never greps source code, uploads source, runs telemetry, or makes hidden network requests.

## Requirements

- VS Code 1.90 or newer.
- The official [Dart extension](https://marketplace.visualstudio.com/items?itemName=Dart-Code.dart-code).
- A Dart/Flutter workspace whose analysis server has finished loading.

## Features

- Usage CodeLens for classes, functions, methods, constructors, enums, and optionally fields/variables.
- Implementation CodeLens for classes, interfaces, and methods.
- Optional caller/callee CodeLens backed by Dart call hierarchy.
- Native Peek References navigation.
- Declaration exclusion and duplicate-location removal.
- Optional generated-file exclusion.
- `tests only` and `generated only` usage hints.
- Lazy resolution, bounded query concurrency, versioned caching, edit invalidation, and debounced refresh.
- Diagnostics report without source content.
- Change-impact reports, affected-module analysis, and a local dependency graph.
- Optional reference heat and local Git blame age hints.

## Commands

Open the Command Palette and search for `Flutter Reference` to enable/disable, refresh, clear the cache, inspect callers/callees, analyze change impact, display a dependency graph, open settings, or show diagnostics.

## Settings

The primary switch is `flutterReference.enabled`. Fields, variables, and enum members default to off to limit visual noise. Search Settings for `Flutter Reference` for all symbol, generated-file, cache, concurrency, debounce, and debug logging controls.

## Development

```bash
npm install
npm run check
npm run test:integration
npm run package
```

Press `F5` in VS Code to start an Extension Development Host, open `test-fixtures/dart_project/lib/reference_fixture.dart`, and wait for Dart analysis to finish.

## Accuracy limits

An empty/failed language-provider response is left unresolved instead of displaying a potentially incorrect count. `0 usages` does not prove dead code: public APIs, generated code, framework conventions, or code outside the workspace may still use a symbol. Getter/setter, extension, mixin, and typedef availability depends on the symbol kinds exposed by the installed Dart extension. Integration fixtures lock behavior for the tested Dart-Code version.

## Privacy

All processing is local. Flutter Reference has no telemetry and no source upload.
