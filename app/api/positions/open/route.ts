import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

// Applications are only accepted before voting opens — see SCOPE.md candidate
// management (approval has to happen before ballots are final).
export async function GET() {
  const auth = await requireApiUser("VOTER");
  if ("error" in auth) return auth.error;

  const positions = await prisma.position.findMany({
    where: { election: { status: { in: ["DRAFT", "SCHEDULED"] } } },
    include: { election: { select: { name: true } } },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(
    positions.map((p) => ({ id: p.id, title: p.title, electionName: p.election.name })),
  );
}
