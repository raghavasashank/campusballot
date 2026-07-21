import { prisma } from "@/lib/prisma";

// FK-safe delete order: children before parents.
export async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.ballot.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.pendingBallot.deleteMany();
  await prisma.voterStatus.deleteMany();
  await prisma.eligibleVoter.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.position.deleteMany();
  await prisma.election.deleteMany();
  await prisma.loginToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createUser(role: "ADMIN" | "VOTER" = "VOTER") {
  return prisma.user.create({
    data: { email: `${unique(role.toLowerCase())}@college.edu`, role },
  });
}

export async function createElection() {
  return prisma.election.create({ data: { name: unique("election") } });
}

export async function createPosition(electionId: string) {
  return prisma.position.create({ data: { electionId, title: unique("position") } });
}

export async function makeEligible(electionId: string, positionIds: string[], userId: string) {
  await prisma.eligibleVoter.create({ data: { electionId, userId } });
  await prisma.voterStatus.createMany({
    data: positionIds.map((positionId) => ({ electionId, positionId, userId })),
  });
}
