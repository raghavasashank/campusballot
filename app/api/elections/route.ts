import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { createElectionDraft } from "@/lib/domain/elections";
import { domainErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const elections = await prisma.election.findMany({
    orderBy: { createdAt: "desc" },
    include: { positions: { select: { id: true } } },
  });

  return NextResponse.json(
    elections.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      opensAt: e.opensAt,
      closesAt: e.closesAt,
      positionCount: e.positions.length,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;

  const { name } = (await request.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Election name is required." }, { status: 400 });

  try {
    const election = await createElectionDraft(auth.userId, name.trim());
    return NextResponse.json(election, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
