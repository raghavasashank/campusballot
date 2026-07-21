import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSessionRecord, validateSession } from "@/lib/session-store";
import { revokeSession, revokeAllSessionsForUser, listActiveSessions } from "@/lib/domain/sessions";
import { AlreadyRevokedError, NotFoundError } from "@/lib/domain/errors";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("revokeSession", () => {
  it("revokes the session and logs the admin action", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);

    await revokeSession(admin.id, id);

    expect(await validateSession(id)).toBeNull();
    const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, target: id } });
    expect(entry!.action).toBe("REVOKE_SESSION");
  });

  it("throws NotFoundError for a session id that doesn't exist", async () => {
    const admin = await createUser("ADMIN");
    await expect(revokeSession(admin.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundError);
  });

  it("throws AlreadyRevokedError when the session was already revoked", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");
    const { id } = await createSessionRecord(user.id);
    await revokeSession(admin.id, id);

    await expect(revokeSession(admin.id, id)).rejects.toThrow(AlreadyRevokedError);
  });

  it("does not affect a different session for the same user", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");
    const kept = await createSessionRecord(user.id);
    const killed = await createSessionRecord(user.id);

    await revokeSession(admin.id, killed.id);

    expect(await validateSession(kept.id)).not.toBeNull();
  });
});

describe("revokeAllSessionsForUser", () => {
  it("revokes every active session for that user and logs once", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");
    const a = await createSessionRecord(user.id);
    const b = await createSessionRecord(user.id);

    const count = await revokeAllSessionsForUser(admin.id, user.id);

    expect(count).toBe(2);
    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();
    const entries = await prisma.auditLog.findMany({ where: { actorId: admin.id, target: user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("REVOKE_ALL_SESSIONS");
  });

  it("does not touch another user's sessions", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");
    const other = await createUser("VOTER");
    const mine = await createSessionRecord(user.id);
    const theirs = await createSessionRecord(other.id);

    await revokeAllSessionsForUser(admin.id, user.id);

    expect(await validateSession(mine.id)).toBeNull();
    expect(await validateSession(theirs.id)).not.toBeNull();
  });

  it("throws NotFoundError for a user that doesn't exist", async () => {
    const admin = await createUser("ADMIN");
    await expect(revokeAllSessionsForUser(admin.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("does not write an audit entry when the user has no active sessions", async () => {
    const admin = await createUser("ADMIN");
    const user = await createUser("VOTER");

    const count = await revokeAllSessionsForUser(admin.id, user.id);

    expect(count).toBe(0);
    const entries = await prisma.auditLog.findMany({ where: { target: user.id } });
    expect(entries).toHaveLength(0);
  });
});

describe("listActiveSessions", () => {
  it("lists only non-revoked, non-expired sessions with the owner's email", async () => {
    const user = await createUser("VOTER");
    const active = await createSessionRecord(user.id);
    const revoked = await createSessionRecord(user.id);
    await revokeSession((await createUser("ADMIN")).id, revoked.id);

    const sessions = await listActiveSessions();

    const ids = sessions.map((s) => s.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(revoked.id);
    expect(sessions.find((s) => s.id === active.id)!.user.email).toBe(user.email);
  });
});
