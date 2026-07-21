import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { addEligibleVoters } from "@/lib/domain/eligibility";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const { emails } = (await request.json().catch(() => ({}))) as { emails?: string };
  const list = (emails ?? "").split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  if (list.length === 0) {
    return NextResponse.json({ error: "Provide at least one email." }, { status: 400 });
  }

  try {
    const users = await addEligibleVoters(auth.userId, id, list);
    return NextResponse.json({ added: users.length });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
