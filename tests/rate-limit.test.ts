import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, _bucketCount } from "@/lib/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to the limit within the window", () => {
    const key = "alice@college.edu:1";
    expect(rateLimit(key, 3, 1000).allowed).toBe(true);
    expect(rateLimit(key, 3, 1000).allowed).toBe(true);
    expect(rateLimit(key, 3, 1000).allowed).toBe(true);
  });

  it("blocks the request after the limit is reached", () => {
    const key = "alice@college.edu:2";
    rateLimit(key, 3, 1000);
    rateLimit(key, 3, 1000);
    rateLimit(key, 3, 1000);

    const result = rateLimit(key, 3, 1000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets once the window has elapsed", () => {
    const key = "alice@college.edu:3";
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));

    expect(rateLimit(key, 1, 1000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    rateLimit("bob@college.edu:1", 1, 1000);
    expect(rateLimit("bob@college.edu:1", 1, 1000).allowed).toBe(false);
    expect(rateLimit("carol@college.edu:1", 1, 1000).allowed).toBe(true);
  });

  it("stays race-safe: N concurrent calls for the same key allow exactly N through", async () => {
    vi.useRealTimers(); // Promise.all needs real microtask scheduling, not fake timers

    const key = "race@college.edu";
    const limit = 5;
    const calls = Array.from({ length: 20 }, () => Promise.resolve().then(() => rateLimit(key, limit, 60_000)));
    const results = await Promise.all(calls);

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(limit);
  });

  it("evicts expired entries over time instead of growing the map forever", () => {
    // Batch sizes are chosen to guarantee crossing the sweep threshold at
    // least once in each batch, regardless of any leftover call count from
    // earlier tests in this file (the sweep counter is module-level).
    for (let i = 0; i < 1000; i++) rateLimit(`evict-a-${i}`, 1, 1000);

    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z")); // past every bucket's 1000ms window

    // By the time a sweep runs in this batch, every entry from the first
    // batch has expired and should be evicted — the map must not hold both
    // batches' worth of entries.
    for (let i = 0; i < 1000; i++) rateLimit(`evict-b-${i}`, 1, 1000);

    expect(_bucketCount()).toBeLessThan(1500);
  });
});
