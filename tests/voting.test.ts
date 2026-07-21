import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyAsCandidate, approveCandidate } from "@/lib/domain/candidates";
import { createElectionDraft } from "@/lib/domain/elections";
import { castVote } from "@/lib/domain/ballots";
import {
  AlreadyVotedError,
  CandidateNotApprovedError,
  ElectionNotOpenError,
  NotEligibleError,
  NotFoundError,
} from "@/lib/domain/errors";
import { createElection, createPosition, createUser, makeEligible, resetDb } from "./helpers";

beforeEach(resetDb);

async function setupOpenElectionWithApprovedCandidate() {
  const admin = await createUser("ADMIN");
  const election = await createElection();
  const position = await createPosition(election.id);
  const applicant = await createUser("VOTER");
  const candidate = await applyAsCandidate(applicant.id, position.id, "Jane Doe");
  await approveCandidate(admin.id, candidate.id);
  await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });
  return { election, position, candidate };
}

describe("vote casting", () => {
  it("records a ballot with no reference to the voter", async () => {
    const { election, position, candidate } = await setupOpenElectionWithApprovedCandidate();
    const voter = await createUser("VOTER");
    await makeEligible(election.id, [position.id], voter.id);

    await castVote(voter.id, position.id, candidate.id);

    const pending = await prisma.pendingBallot.findMany({ where: { positionId: position.id } });
    expect(pending).toHaveLength(1);
    expect(pending[0].candidateId).toBe(candidate.id);
    expect(pending[0]).not.toHaveProperty("userId");

    const status = await prisma.voterStatus.findUniqueOrThrow({
      where: { electionId_positionId_userId: { electionId: election.id, positionId: position.id, userId: voter.id } },
    });
    expect(status.hasVoted).toBe(true);
  });

  it("rejects a second vote from the same student for the same position", async () => {
    const { election, position, candidate } = await setupOpenElectionWithApprovedCandidate();
    const voter = await createUser("VOTER");
    await makeEligible(election.id, [position.id], voter.id);

    await castVote(voter.id, position.id, candidate.id);

    await expect(castVote(voter.id, position.id, candidate.id)).rejects.toThrow(AlreadyVotedError);

    const pending = await prisma.pendingBallot.findMany({ where: { positionId: position.id } });
    expect(pending).toHaveLength(1);
  });

  it("rejects a vote from a student who isn't on the eligibility list", async () => {
    const { position, candidate } = await setupOpenElectionWithApprovedCandidate();
    const voter = await createUser("VOTER");

    await expect(castVote(voter.id, position.id, candidate.id)).rejects.toThrow(NotEligibleError);
  });

  it("rejects a vote for a candidate that hasn't been approved", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });
    const applicant = await createUser("VOTER");
    const pendingCandidate = await applyAsCandidate(applicant.id, position.id, "Jane Doe");
    const voter = await createUser("VOTER");
    await makeEligible(election.id, [position.id], voter.id);

    await expect(castVote(voter.id, position.id, pendingCandidate.id)).rejects.toThrow(
      CandidateNotApprovedError,
    );
  });

  it("rejects a vote while the election isn't open", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Not open yet");
    const position = await createPosition(election.id);
    const applicant = await createUser("VOTER");
    const candidate = await applyAsCandidate(applicant.id, position.id, "Jane Doe");
    await approveCandidate(admin.id, candidate.id);
    const voter = await createUser("VOTER");
    await makeEligible(election.id, [position.id], voter.id);

    await expect(castVote(voter.id, position.id, candidate.id)).rejects.toThrow(ElectionNotOpenError);
  });

  it("rejects a candidateId that belongs to a different position in the same election (IDOR)", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const positionA = await createPosition(election.id);
    const positionB = await createPosition(election.id);
    await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });

    const applicantB = await createUser("VOTER");
    const candidateForB = await applyAsCandidate(applicantB.id, positionB.id, "Runs for B only");
    await approveCandidate(admin.id, candidateForB.id);

    const voter = await createUser("VOTER");
    await makeEligible(election.id, [positionA.id], voter.id);

    // Submitting positionA's URL/context with positionB's candidateId must
    // not be able to cast a vote for a candidate outside that position.
    await expect(castVote(voter.id, positionA.id, candidateForB.id)).rejects.toThrow(NotFoundError);

    const pending = await prisma.pendingBallot.findMany({ where: { positionId: positionA.id } });
    expect(pending).toHaveLength(0);
  });

  it("rejects a candidateId that belongs to a position in a different election entirely (IDOR)", async () => {
    const admin = await createUser("ADMIN");

    const { election: electionA, position: positionA } = await setupOpenElectionWithApprovedCandidate();

    const electionB = await createElection();
    const positionInB = await createPosition(electionB.id);
    await prisma.election.update({ where: { id: electionB.id }, data: { status: "OPEN" } });
    const applicantInB = await createUser("VOTER");
    const candidateInB = await applyAsCandidate(applicantInB.id, positionInB.id, "Runs in election B only");
    await approveCandidate(admin.id, candidateInB.id);

    const voter = await createUser("VOTER");
    await makeEligible(electionA.id, [positionA.id], voter.id);

    await expect(castVote(voter.id, positionA.id, candidateInB.id)).rejects.toThrow(NotFoundError);

    const pending = await prisma.pendingBallot.findMany({ where: { positionId: positionA.id } });
    expect(pending).toHaveLength(0);
  });

  it("allows exactly one of two concurrent votes from the same student to succeed", async () => {
    const { election, position, candidate } = await setupOpenElectionWithApprovedCandidate();
    const voter = await createUser("VOTER");
    await makeEligible(election.id, [position.id], voter.id);

    const results = await Promise.allSettled([
      castVote(voter.id, position.id, candidate.id),
      castVote(voter.id, position.id, candidate.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AlreadyVotedError);

    const pending = await prisma.pendingBallot.findMany({ where: { positionId: position.id } });
    expect(pending).toHaveLength(1);

    const status = await prisma.voterStatus.findUniqueOrThrow({
      where: { electionId_positionId_userId: { electionId: election.id, positionId: position.id, userId: voter.id } },
    });
    expect(status.hasVoted).toBe(true);
  });
});
