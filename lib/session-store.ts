import { prisma } from "@/lib/prisma";
import { conditionalUpdate } from "@/lib/atomic-guard";
import type { Role } from "@/app/generated/prisma/client";

const SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

// DB-backed session record — one row per login. Kept separate from
// lib/session.ts (the cookie layer, which needs next/headers request
// context and can't be unit tested directly) for the same reason
// consumeLoginToken lives in lib/tokens.ts rather than the auth route.
export async function createSessionRecord(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return { id: session.id, expiresAt: session.expiresAt };
}

export async function validateSession(sessionId: string): Promise<{ userId: string; role: Role } | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return { userId: session.user.id, role: session.user.role };
}

// Atomic conditional update, not read-then-write — two concurrent calls for
// the same session must not both report success. See lib/atomic-guard.ts.
export async function revokeSessionRecord(sessionId: string): Promise<boolean> {
  const count = await conditionalUpdate(
    prisma.session,
    { id: sessionId, revokedAt: null },
    { revokedAt: new Date() },
  );
  return count > 0;
}

export async function revokeAllSessionRecordsForUser(userId: string): Promise<number> {
  return conditionalUpdate(prisma.session, { userId, revokedAt: null }, { revokedAt: new Date() });
}
