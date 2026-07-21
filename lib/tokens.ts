import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { conditionalUpdate } from "@/lib/atomic-guard";
import type { Role } from "@/app/generated/prisma/client";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) };
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// Consuming a magic-link token must be a single atomic conditional UPDATE,
// not a separate check-then-write — otherwise two concurrent calls (a
// double-clicked confirm button, or a race) can both pass a `usedAt is
// null` check before either write lands, and both succeed from one
// "single-use" token. See lib/atomic-guard.ts. Returns null for any failure
// reason (not found, expired, already used) — callers don't need to
// distinguish them.
export async function consumeLoginToken(rawToken: string): Promise<{ userId: string; role: Role } | null> {
  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (!loginToken || loginToken.expiresAt < new Date()) return null;

  const count = await conditionalUpdate(
    prisma.loginToken,
    { id: loginToken.id, usedAt: null, expiresAt: { gt: new Date() } },
    { usedAt: new Date() },
  );
  if (count === 0) return null;

  return { userId: loginToken.user.id, role: loginToken.user.role };
}
