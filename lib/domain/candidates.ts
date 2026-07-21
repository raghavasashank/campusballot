import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/domain/audit";
import { DuplicateApplicationError, InvalidTransitionError, NotFoundError } from "@/lib/domain/errors";

export async function applyAsCandidate(
  applicantId: string,
  positionId: string,
  name: string,
  bio?: string,
  photoUrl?: string,
) {
  const existing = await prisma.candidate.findUnique({
    where: { positionId_applicantId: { positionId, applicantId } },
  });
  if (existing) throw new DuplicateApplicationError("Already applied for this position.");

  return prisma.candidate.create({ data: { positionId, applicantId, name, bio, photoUrl } });
}

async function reviewCandidate(adminId: string, candidateId: string, status: "APPROVED" | "REJECTED") {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundError("Candidate not found.");
    if (candidate.status !== "PENDING") {
      throw new InvalidTransitionError(`Candidate already ${candidate.status.toLowerCase()}.`);
    }

    const updated = await tx.candidate.update({
      where: { id: candidateId },
      data: { status, reviewedAt: new Date() },
    });
    await logAction(tx, adminId, status === "APPROVED" ? "APPROVE_CANDIDATE" : "REJECT_CANDIDATE", candidateId);
    return updated;
  });
}

export async function approveCandidate(adminId: string, candidateId: string) {
  return reviewCandidate(adminId, candidateId, "APPROVED");
}

export async function rejectCandidate(adminId: string, candidateId: string) {
  return reviewCandidate(adminId, candidateId, "REJECTED");
}
