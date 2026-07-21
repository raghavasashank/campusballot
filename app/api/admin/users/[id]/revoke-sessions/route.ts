import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { revokeAllSessionsForUser } from "@/lib/domain/sessions";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    const revoked = await revokeAllSessionsForUser(auth.userId, id);
    return NextResponse.json({ revoked });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
