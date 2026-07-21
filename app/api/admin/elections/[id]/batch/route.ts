import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { drainBatch } from "@/lib/domain/batch";
import { domainErrorResponse } from "@/lib/api-errors";

// Manual stand-in for the batch worker (see README "Not built yet") — drains
// every position's pending ballots into the immutable, shuffled Ballot table.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    const positions = await prisma.position.findMany({ where: { electionId: id } });
    const batches = await Promise.all(positions.map((p) => drainBatch(id, p.id)));
    return NextResponse.json({ batchesRun: batches.length });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
