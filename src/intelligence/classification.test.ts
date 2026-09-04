import { describe, expect, it } from "vitest";
import { classifySourcePath } from "./classification";

describe("portable source classification", () => {
  it.each([
    ["lib/product.dart", "production"],
    ["test/product_test.dart", "test"],
    ["integration_test/app_test.dart", "test"],
    ["lib/product.g.dart", "generated"],
    ["C:\\workspace\\lib\\model.freezed.dart", "generated"]
  ] as const)("classifies %s as %s", (sourcePath, expected) => {
    expect(classifySourcePath(sourcePath)).toBe(expected);
  });
});
