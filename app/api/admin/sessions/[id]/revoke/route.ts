import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { revokeSession } from "@/lib/domain/sessions";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    await revokeSession(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
