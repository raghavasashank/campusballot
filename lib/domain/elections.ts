import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/domain/audit";
import { InvalidTransitionError, NotFoundError } from "@/lib/domain/errors";
import {
  notifyElectionClosed,
  notifyElectionOpened,
  notifyElectionScheduled,
  notifyResultsPublished,
} from "@/lib/domain/notifications";
import type { ElectionStatus } from "@/app/generated/prisma/client";

// Only these transitions are legal — the state machine SCOPE.md/ARCHITECTURE.md describe.
const ALLOWED_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  DRAFT: ["SCHEDULED"],
  SCHEDULED: ["OPEN"],
  OPEN: ["CLOSED"],
  CLOSED: ["RESULTS_PUBLISHED"],
  RESULTS_PUBLISHED: [],
};

async function transition(adminId: string, electionId: string, to: ElectionStatus, action: string, extra?: object) {
  return prisma.$transaction(async (tx) => {
    const election = await tx.election.findUnique({ where: { id: electionId } });
    if (!election) throw new NotFoundError("Election not found.");
    if (!ALLOWED_TRANSITIONS[election.status].includes(to)) {
      throw new InvalidTransitionError(`Cannot move election from ${election.status} to ${to}.`);
    }

    const updated = await tx.election.update({
      where: { id: electionId },
      data: { status: to, ...extra },
    });
    await logAction(tx, adminId, action, electionId);
    return updated;
  });
}

export async function createElectionDraft(adminId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const election = await tx.election.create({ data: { name } });
    await logAction(tx, adminId, "CREATE_ELECTION", election.id);
    return election;
  });
}

export async function scheduleElection(adminId: string, electionId: string, opensAt: Date, closesAt: Date) {
  const election = await transition(adminId, electionId, "SCHEDULED", "SCHEDULE_ELECTION", { opensAt, closesAt });
  await notifyElectionScheduled(electionId, election.name, opensAt, closesAt);
  return election;
}

export async function openElection(adminId: string, electionId: string) {
  const election = await transition(adminId, electionId, "OPEN", "OPEN_ELECTION");
  await notifyElectionOpened(electionId, election.name);
  return election;
}

export async function closeElection(adminId: string, electionId: string) {
  const election = await transition(adminId, electionId, "CLOSED", "CLOSE_ELECTION");
  await notifyElectionClosed(electionId, election.name);
  return election;
}

export async function publishResults(adminId: string, electionId: string) {
  const election = await transition(adminId, electionId, "RESULTS_PUBLISHED", "PUBLISH_RESULTS");
  await notifyResultsPublished(electionId, election.name);
  return election;
}
