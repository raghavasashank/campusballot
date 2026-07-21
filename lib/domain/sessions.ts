import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/domain/audit";
import { NotFoundError, AlreadyRevokedError } from "@/lib/domain/errors";

// Admin-facing session revocation — audited like every other state-changing
// admin action (see SCOPE.md: this is the accountability mechanism for the
// merged admin role). The actual atomic revoke lives in lib/session-store.ts;
// this layer adds existence checks + audit logging on top.

export async function revokeSession(adminId: string, sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError("Session not found.");

    const { count } = await tx.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new AlreadyRevokedError("Session was already revoked.");

    await logAction(tx, adminId, "REVOKE_SESSION", sessionId);
  });
}

export async function revokeAllSessionsForUser(adminId: string, userId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");

    const { count } = await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count > 0) {
      await logAction(tx, adminId, "REVOKE_ALL_SESSIONS", userId);
    }
    return count;
  });
}

export async function listActiveSessions() {
  return prisma.session.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}
