import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma/client";

// Admin accounts (the developer/operator) are allowed to sign in from
// outside the institutional domain — everyone else must match it exactly.
// Both `email` and `adminEmails` are expected already normalized (trimmed,
// lowercased) by the caller.
export function isEligibleEmail(email: string, allowedDomain: string, adminEmails: string[]): boolean {
  return email.endsWith(`@${allowedDomain}`) || adminEmails.includes(email);
}

// For server components/pages: redirects rather than erroring, since there's
// no API response to return.
export async function requirePageUser(role?: Role) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (role && session.role !== role) redirect("/");
  return prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
}

// For route handlers: returns a ready-to-return NextResponse on failure so
// callers can `if ("error" in auth) return auth.error;` and keep going.
export async function requireApiUser(role?: Role) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (role && session.role !== role) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { userId: session.userId, role: session.role } as const;
}
