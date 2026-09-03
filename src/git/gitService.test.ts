import { describe, expect, it } from "vitest";
import { relativeAge } from "./gitService";

describe("relativeAge", () => {
  const now = 2_000_000_000_000;

  it("formats bounded relative time", () => {
    expect(relativeAge(now, now)).toBe("changed just now");
    expect(relativeAge(now - 5 * 60_000, now)).toBe("changed 5m ago");
    expect(relativeAge(now - 3 * 3_600_000, now)).toBe("changed 3h ago");
    expect(relativeAge(now - 9 * 86_400_000, now)).toBe("changed 9d ago");
    expect(relativeAge(now - 800 * 86_400_000, now)).toBe("changed 2y ago");
  });
});
