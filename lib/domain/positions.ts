import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/domain/audit";
import { NotFoundError } from "@/lib/domain/errors";

export async function addPosition(adminId: string, electionId: string, title: string) {
  return prisma.$transaction(async (tx) => {
    const election = await tx.election.findUnique({
      where: { id: electionId },
      include: { eligibleVoters: true },
    });
    if (!election) throw new NotFoundError("Election not found.");

    const position = await tx.position.create({ data: { electionId, title } });

    // Backfill the vote gate for anyone already marked eligible, in case
    // positions are added after the eligibility list — see eligibility.ts.
    if (election.eligibleVoters.length > 0) {
      await tx.voterStatus.createMany({
        data: election.eligibleVoters.map((ev) => ({
          electionId,
          positionId: position.id,
          userId: ev.userId,
        })),
        skipDuplicates: true,
      });
    }

    await logAction(tx, adminId, "ADD_POSITION", position.id);
    return position;
  });
}
