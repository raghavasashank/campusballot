import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createSessionRecord,
  validateSession,
  revokeSessionRecord,
  revokeAllSessionRecordsForUser,
} from "@/lib/session-store";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("createSessionRecord + validateSession", () => {
  it("validates a freshly created session and returns the user's role", async () => {
    const user = await createUser("ADMIN");
    const { id } = await createSessionRecord(user.id);

    const result = await validateSession(id);

    expect(result).toEqual({ userId: user.id, role: "ADMIN" });
  });

  it("rejects a session id that doesn't exist", async () => {
    expect(await validateSession("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("rejects an expired session", async () => {
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await validateSession(id)).toBeNull();
  });

  it("rejects a revoked session", async () => {
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);
    await revokeSessionRecord(id);

    expect(await validateSession(id)).toBeNull();
  });
});

describe("concurrent session creation", () => {
  // Raised by a security council review pattern-matching "the team missed a
  // check-then-act race twice before (magic-link consumption, CSV
  // preview/confirm), there's probably a third in the newest code."
  // createSessionRecord is a plain INSERT with no shared mutable state being
  // contended (multiple sessions per user are allowed by design), so this is
  // expected to already be safe — this test converts that reasoning into a
  // permanent, verified guarantee rather than leaving it as an assertion.
  it("produces two independent, non-colliding sessions when two logins race for the same user", async () => {
    const user = await createUser("VOTER");

    const [a, b] = await Promise.all([createSessionRecord(user.id), createSessionRecord(user.id)]);

    expect(a.id).not.toBe(b.id);

    const [validA, validB] = await Promise.all([validateSession(a.id), validateSession(b.id)]);
    expect(validA).toEqual({ userId: user.id, role: "VOTER" });
    expect(validB).toEqual({ userId: user.id, role: "VOTER" });

    const rows = await prisma.session.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });

  it("revoking one session from a concurrently-created pair leaves the other untouched", async () => {
    const user = await createUser("VOTER");

    const [a, b] = await Promise.all([createSessionRecord(user.id), createSessionRecord(user.id)]);
    await revokeSessionRecord(a.id);

    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).not.toBeNull();
  });
});

describe("revokeSessionRecord", () => {
  it("revokes exactly the targeted session, not other sessions for the same user", async () => {
    const user = await createUser("VOTER");
    const sessionA = await createSessionRecord(user.id);
    const sessionB = await createSessionRecord(user.id);

    const revoked = await revokeSessionRecord(sessionA.id);

    expect(revoked).toBe(true);
    expect(await validateSession(sessionA.id)).toBeNull();
    expect(await validateSession(sessionB.id)).not.toBeNull();
  });

  it("returns false when revoking a session that was already revoked", async () => {
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);
    await revokeSessionRecord(id);

    expect(await revokeSessionRecord(id)).toBe(false);
  });

  it("returns false for a session id that doesn't exist", async () => {
    expect(await revokeSessionRecord("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("takes effect immediately — a session validated right after revocation is rejected", async () => {
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);

    expect(await validateSession(id)).not.toBeNull();
    await revokeSessionRecord(id);
    expect(await validateSession(id)).toBeNull();
  });

  it("allows exactly one of two concurrent revocations of the same session to report success", async () => {
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);

    const [first, second] = await Promise.all([revokeSessionRecord(id), revokeSessionRecord(id)]);

    const succeeded = [first, second].filter(Boolean);
    expect(succeeded).toHaveLength(1);
    expect(await validateSession(id)).toBeNull();
  });
});

describe("revokeAllSessionRecordsForUser", () => {
  it("revokes every active session for that user and returns the count", async () => {
    const user = await createUser("VOTER");
    const a = await createSessionRecord(user.id);
    const b = await createSessionRecord(user.id);

    const count = await revokeAllSessionRecordsForUser(user.id);

    expect(count).toBe(2);
    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();
  });

  it("does not touch another user's sessions", async () => {
    const user = await createUser("VOTER");
    const other = await createUser("VOTER");
    const mine = await createSessionRecord(user.id);
    const theirs = await createSessionRecord(other.id);

    await revokeAllSessionRecordsForUser(user.id);

    expect(await validateSession(mine.id)).toBeNull();
    expect(await validateSession(theirs.id)).not.toBeNull();
  });

  it("does not re-count sessions that were already revoked", async () => {
    const user = await createUser("VOTER");
    const a = await createSessionRecord(user.id);
    await revokeSessionRecord(a.id);
    await createSessionRecord(user.id);

    const count = await revokeAllSessionRecordsForUser(user.id);

    expect(count).toBe(1);
  });
});
