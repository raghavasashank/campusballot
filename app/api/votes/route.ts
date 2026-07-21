import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { castVote } from "@/lib/domain/ballots";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  const auth = await requireApiUser("VOTER");
  if ("error" in auth) return auth.error;

  const { positionId, candidateId } = (await request.json().catch(() => ({}))) as {
    positionId?: string;
    candidateId?: string;
  };
  if (!positionId || !candidateId) {
    return NextResponse.json({ error: "positionId and candidateId are required." }, { status: 400 });
  }

  try {
    const receipt = await castVote(auth.userId, positionId, candidateId);
    return NextResponse.json(receipt);
  } catch (err) {
    return domainErrorResponse(err);
  }
}
