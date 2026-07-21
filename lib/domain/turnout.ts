import { prisma } from "@/lib/prisma";

export async function getTurnout(electionId: string) {
  const positions = await prisma.position.findMany({
    where: { electionId },
    include: {
      _count: { select: { voterStatuses: true, pendingBallots: true, ballots: true } },
    },
  });

  return Promise.all(
    positions.map(async (p) => {
      const voted = await prisma.voterStatus.count({ where: { positionId: p.id, hasVoted: true } });
      return {
        positionId: p.id,
        title: p.title,
        eligible: p._count.voterStatuses,
        voted,
        pendingBallots: p._count.pendingBallots,
        batchedBallots: p._count.ballots,
      };
    }),
  );
}
