import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { closeElection } from "@/lib/domain/elections";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    return NextResponse.json(await closeElection(auth.userId, id));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
