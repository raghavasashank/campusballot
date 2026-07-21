import { prisma } from "@/lib/prisma";
import { conditionalUpdate } from "@/lib/atomic-guard";
import {
  AlreadyVotedError,
  CandidateNotApprovedError,
  ElectionNotOpenError,
  NotEligibleError,
  NotFoundError,
} from "@/lib/domain/errors";

// The one-vote-per-position gate (ARCHITECTURE.md requirement 1) plus the
// unlinked ballot write (requirement 2), in a single transaction. The
// VoterStatus flip is a conditional UPDATE (`updateMany` with `hasVoted:
// false` in the WHERE clause) rather than read-then-write — that's what
// makes it race-safe: concurrent requests serialize on the same row via the
// database's row lock, and only one UPDATE can ever match. See
// lib/atomic-guard.ts and ARCHITECTURE.md's "Atomic conditional updates" section.
export async function castVote(userId: string, positionId: string, candidateId: string) {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { election: true },
  });
  if (!position) throw new NotFoundError("Position not found.");
  if (position.election.status !== "OPEN") {
    throw new ElectionNotOpenError("Election is not open for voting.");
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.positionId !== positionId) {
    throw new NotFoundError("Candidate not found for this position.");
  }
  if (candidate.status !== "APPROVED") {
    throw new CandidateNotApprovedError("Candidate has not been approved.");
  }

  const electionId = position.electionId;

  // The receipt is proof of participation only — it must never let the
  // voter (or anyone they show it to) recover which candidate they picked,
  // per ARCHITECTURE.md's accepted receipt-freeness limitation. Callers must
  // not echo the candidate back alongside this value.
  return prisma.$transaction(async (tx) => {
    const count = await conditionalUpdate(
      tx.voterStatus,
      { electionId, positionId, userId, hasVoted: false },
      { hasVoted: true, votedAt: new Date() },
    );

    if (count === 0) {
      const status = await tx.voterStatus.findUnique({
        where: { electionId_positionId_userId: { electionId, positionId, userId } },
      });
      if (!status) throw new NotEligibleError("Student is not eligible to vote in this position.");
      throw new AlreadyVotedError("Student has already voted for this position.");
    }

    const ballot = await tx.pendingBallot.create({ data: { electionId, positionId, candidateId } });
    return { receiptId: ballot.id, votedAt: ballot.queuedAt };
  });
}
