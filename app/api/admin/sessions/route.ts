import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { listActiveSessions } from "@/lib/domain/sessions";

export async function GET() {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;

  const sessions = await listActiveSessions();

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user.email,
      role: s.user.role,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
  );
}
