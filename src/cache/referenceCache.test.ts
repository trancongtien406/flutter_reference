import { describe, expect, it } from "vitest";
import { ReferenceCache } from "./referenceCache";

describe("ReferenceCache", () => {
  it("tracks access and invalidates one URI", () => {
    const cache = new ReferenceCache<number>();
    cache.set("file:///a.dart#1", 1);
    cache.set("file:///b.dart#1", 2);
    expect(cache.get("file:///a.dart#1")).toBe(1);
    expect(cache.get("missing")).toBeUndefined();
    cache.invalidateUri("file:///a.dart");
    expect(cache.get("file:///a.dart#1")).toBeUndefined();
    expect(cache.get("file:///b.dart#1")).toBe(2);
    expect(cache.stats()).toEqual({ size: 1, hits: 2, misses: 2 });
    cache.clear();
    expect(cache.stats().size).toBe(0);
  });
});
