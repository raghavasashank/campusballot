import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const election = await prisma.election.findUnique({
    where: { id },
    include: {
      positions: {
        include: {
          candidates: { where: { status: "APPROVED" } },
        },
      },
    },
  });
  if (!election) return NextResponse.json({ error: "Election not found." }, { status: 404 });

  const voterStatuses =
    auth.role === "VOTER"
      ? await prisma.voterStatus.findMany({ where: { electionId: id, userId: auth.userId } })
      : [];
  const votedPositionIds = new Set(voterStatuses.filter((v) => v.hasVoted).map((v) => v.positionId));
  const eligiblePositionIds = new Set(voterStatuses.map((v) => v.positionId));

  return NextResponse.json({
    id: election.id,
    name: election.name,
    status: election.status,
    opensAt: election.opensAt,
    closesAt: election.closesAt,
    positions: election.positions.map((p) => ({
      id: p.id,
      title: p.title,
      candidates: p.candidates.map((c) => ({ id: c.id, name: c.name, bio: c.bio, photoUrl: c.photoUrl })),
      hasVoted: votedPositionIds.has(p.id),
      isEligible: auth.role === "VOTER" ? eligiblePositionIds.has(p.id) : undefined,
    })),
  });
}
