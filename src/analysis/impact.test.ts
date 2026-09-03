import { describe, expect, it } from "vitest";
import { moduleForUri, summarizeImpact } from "./impact";

const uri = (path: string): import("vscode").Uri =>
  ({
    path,
    toString: (): string => `file://${path}`
  }) as import("vscode").Uri;

const location = (path: string): import("vscode").Location => ({ uri: uri(path) }) as import("vscode").Location;

describe("impact analysis", () => {
  it("derives feature modules from conventional Dart paths", () => {
    expect(moduleForUri(uri("/workspace/lib/features/cart/service.dart"))).toBe("features");
    expect(moduleForUri(uri("/workspace/test/product/service_test.dart"))).toBe("product");
  });

  it("summarizes location classes, files, modules, and implementations", () => {
    const result = summarizeImpact(
      [
        location("/workspace/lib/cart/a.dart"),
        location("/workspace/lib/cart/a.dart"),
        location("/workspace/test/cart_test.dart"),
        location("/workspace/lib/model.g.dart")
      ],
      [location("/workspace/lib/cart/impl.dart")]
    );
    expect(result).toEqual({
      total: 4,
      production: 2,
      tests: 1,
      generated: 1,
      implementations: 1,
      modules: ["cart", "cart_test.dart", "model.g.dart"],
      files: 3
    });
  });
});
