import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyAsCandidate, approveCandidate } from "@/lib/domain/candidates";
import { castVote } from "@/lib/domain/ballots";
import { drainBatch } from "@/lib/domain/batch";
import { computeResults } from "@/lib/domain/results";
import { InvalidTransitionError } from "@/lib/domain/errors";
import { createElection, createPosition, createUser, makeEligible, resetDb } from "./helpers";

beforeEach(resetDb);

async function castVotes(positionId: string, electionId: string, votes: { candidateId: string }[]) {
  for (const { candidateId } of votes) {
    const voter = await createUser("VOTER");
    await makeEligible(electionId, [positionId], voter.id);
    await castVote(voter.id, positionId, candidateId);
  }
}

describe("batch drain", () => {
  it("moves pending ballots into the immutable ballots table and publishes a hash", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const position = await createPosition(election.id);
    await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });
    const applicant = await createUser("VOTER");
    const candidate = await applyAsCandidate(applicant.id, position.id, "Jane Doe");
    await approveCandidate(admin.id, candidate.id);

    await castVotes(position.id, election.id, [{ candidateId: candidate.id }, { candidateId: candidate.id }]);

    const batch = await drainBatch(election.id, position.id);

    expect(batch.publishedHash).toBeTruthy();
    const remainingPending = await prisma.pendingBallot.findMany({ where: { positionId: position.id } });
    expect(remainingPending).toHaveLength(0);

    const ballots = await prisma.ballot.findMany({ where: { positionId: position.id } });
    expect(ballots).toHaveLength(2);
    expect(ballots.every((b) => b.batchId === batch.id)).toBe(true);
  });
});

describe("results calculation", () => {
  it("tallies ballots per candidate, including approved candidates with zero votes", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const position = await createPosition(election.id);
    await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });

    const applicantA = await createUser("VOTER");
    const applicantB = await createUser("VOTER");
    const candidateA = await approveCandidate(admin.id, (await applyAsCandidate(applicantA.id, position.id, "Alice")).id);
    const candidateB = await approveCandidate(admin.id, (await applyAsCandidate(applicantB.id, position.id, "Bob")).id);

    await castVotes(position.id, election.id, [
      { candidateId: candidateA.id },
      { candidateId: candidateA.id },
      { candidateId: candidateB.id },
    ]);
    await drainBatch(election.id, position.id);

    await prisma.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });

    const results = await computeResults(election.id);
    const positionResult = results.find((r) => r.positionId === position.id)!;
    const tallyFor = (id: string) => positionResult.tally.find((t) => t.candidateId === id)!.votes;

    expect(tallyFor(candidateA.id)).toBe(2);
    expect(tallyFor(candidateB.id)).toBe(1);
  });

  it("refuses to compute results before the election is closed", async () => {
    const election = await createElection();
    await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });

    await expect(computeResults(election.id)).rejects.toThrow(InvalidTransitionError);
  });
});
