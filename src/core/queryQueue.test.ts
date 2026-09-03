import { describe, expect, it } from "vitest";
import { QueryQueue } from "./queryQueue";

describe("QueryQueue", () => {
  it("honors the concurrency limit", async () => {
    const queue = new QueryQueue(() => 2);
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 8 }, (_, value) =>
      queue.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return value;
      })
    );
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(2);
  });
});
