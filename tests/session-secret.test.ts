import { afterEach, describe, expect, it, vi } from "vitest";
import { secret, INSECURE_DEFAULT_SECRET } from "@/lib/session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session secret safety check", () => {
  it("refuses to run with the insecure default secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", INSECURE_DEFAULT_SECRET);

    expect(() => secret()).toThrow(/insecure default/i);
  });

  it("allows the default secret outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", INSECURE_DEFAULT_SECRET);

    expect(() => secret()).not.toThrow();
  });

  it("allows a real secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a-real-randomly-generated-secret");

    expect(() => secret()).not.toThrow();
  });

  it("still throws when unset, regardless of environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "");
    delete process.env.SESSION_SECRET;

    expect(() => secret()).toThrow(/not set/i);
  });
});
