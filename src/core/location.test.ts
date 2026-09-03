import { describe, expect, it } from "vitest";
import { classifyUri, isDeclaration, locationKey, usageLabel } from "./location";

describe("usageLabel", () => {
  it("pluralizes usage counts", () => {
    expect(usageLabel(1, 0, 0)).toBe("1 usage");
    expect(usageLabel(2, 0, 0)).toBe("2 usages");
    expect(usageLabel(0, 0, 0)).toBe("0 usages");
  });

  it("describes test-only and generated-only references", () => {
    expect(usageLabel(0, 3, 0)).toBe("3 usages · tests only");
    expect(usageLabel(0, 0, 2)).toBe("2 usages · generated only");
  });
});

describe("classifyUri", () => {
  const uri = (path: string): import("vscode").Uri => ({ path }) as import("vscode").Uri;

  it("classifies generated and test paths", () => {
    expect(classifyUri(uri("/app/lib/model.freezed.dart"))).toBe("generated");
    expect(classifyUri(uri("/app/integration_test/login_test.dart"))).toBe("test");
    expect(classifyUri(uri("/app/lib/service.dart"))).toBe("production");
  });
});

describe("location normalization", () => {
  const uri = { toString: (): string => "file:///fixture.dart" } as import("vscode").Uri;
  const position = { line: 3, character: 4 } as import("vscode").Position;
  const range = {
    start: position,
    end: { line: 3, character: 8 },
    contains: (): boolean => true
  } as unknown as import("vscode").Range;
  const location: import("vscode").Location = { uri, range };

  it("creates stable keys and identifies the declaration", () => {
    expect(locationKey(location)).toBe("file:///fixture.dart#3:4-3:8");
    expect(isDeclaration(location, location)).toBe(true);
    const other = { ...location, uri: { toString: (): string => "file:///other.dart" } as import("vscode").Uri };
    expect(isDeclaration(other, location)).toBe(false);
  });
});
