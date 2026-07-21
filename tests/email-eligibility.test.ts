import { describe, expect, it } from "vitest";
import { isEligibleEmail } from "@/lib/auth";

describe("isEligibleEmail", () => {
  it("allows an email on the institutional domain", () => {
    expect(isEligibleEmail("alice@college.edu", "college.edu", [])).toBe(true);
  });

  it("rejects an email on a different domain", () => {
    expect(isEligibleEmail("alice@gmail.com", "college.edu", [])).toBe(false);
  });

  it("allows an admin email even outside the institutional domain", () => {
    expect(isEligibleEmail("admin@gmail.com", "college.edu", ["admin@gmail.com"])).toBe(true);
  });

  it("does not treat an arbitrary off-domain email as admin just because some admin list exists", () => {
    expect(isEligibleEmail("intruder@gmail.com", "college.edu", ["admin@gmail.com"])).toBe(false);
  });
});
