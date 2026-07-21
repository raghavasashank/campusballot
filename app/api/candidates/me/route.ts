import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireApiUser("VOTER");
  if ("error" in auth) return auth.error;

  const applications = await prisma.candidate.findMany({
    where: { applicantId: auth.userId },
    include: { position: { include: { election: { select: { name: true } } } } },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(
    applications.map((c) => ({
      id: c.id,
      name: c.name,
      bio: c.bio,
      photoUrl: c.photoUrl,
      status: c.status,
      appliedAt: c.appliedAt,
      reviewedAt: c.reviewedAt,
      positionTitle: c.position.title,
      electionName: c.position.election.name,
    })),
  );
}
