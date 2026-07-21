import { prisma } from "@/lib/prisma";
import { InvalidTransitionError, NotFoundError } from "@/lib/domain/errors";

export async function computeResults(electionId: string) {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        include: {
          candidates: { where: { status: "APPROVED" } },
          ballots: true,
        },
      },
    },
  });
  if (!election) throw new NotFoundError("Election not found.");
  if (election.status !== "CLOSED" && election.status !== "RESULTS_PUBLISHED") {
    throw new InvalidTransitionError("Results can only be computed once the election is closed.");
  }

  return election.positions.map((position) => {
    const counts = new Map<string, number>();
    for (const candidate of position.candidates) counts.set(candidate.id, 0);
    for (const ballot of position.ballots) {
      counts.set(ballot.candidateId, (counts.get(ballot.candidateId) ?? 0) + 1);
    }

    return {
      positionId: position.id,
      positionTitle: position.title,
      tally: position.candidates.map((candidate) => ({
        candidateId: candidate.id,
        name: candidate.name,
        votes: counts.get(candidate.id) ?? 0,
      })),
    };
  });
}
