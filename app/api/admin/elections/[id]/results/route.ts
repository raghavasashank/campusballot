import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { computeResults } from "@/lib/domain/results";
import { domainErrorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    return NextResponse.json(await computeResults(id));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
