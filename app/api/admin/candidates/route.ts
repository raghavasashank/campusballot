import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import type { CandidateStatus } from "@/app/generated/prisma/client";

export async function GET(request: Request) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status") as CandidateStatus | null;

  const candidates = await prisma.candidate.findMany({
    where: status ? { status } : undefined,
    include: {
      applicant: { select: { email: true } },
      position: { include: { election: { select: { name: true } } } },
    },
    orderBy: { appliedAt: "asc" },
  });

  return NextResponse.json(
    candidates.map((c) => ({
      id: c.id,
      name: c.name,
      bio: c.bio,
      photoUrl: c.photoUrl,
      status: c.status,
      appliedAt: c.appliedAt,
      applicantEmail: c.applicant.email,
      positionTitle: c.position.title,
      electionName: c.position.election.name,
    })),
  );
}
