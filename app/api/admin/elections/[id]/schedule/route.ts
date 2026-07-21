import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { scheduleElection } from "@/lib/domain/elections";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const { opensAt, closesAt } = (await request.json().catch(() => ({}))) as {
    opensAt?: string;
    closesAt?: string;
  };
  if (!opensAt || !closesAt) {
    return NextResponse.json({ error: "opensAt and closesAt are required." }, { status: 400 });
  }

  try {
    const election = await scheduleElection(auth.userId, id, new Date(opensAt), new Date(closesAt));
    return NextResponse.json(election);
  } catch (err) {
    return domainErrorResponse(err);
  }
}
