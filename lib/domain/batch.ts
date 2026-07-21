import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Drains PendingBallot into the immutable Ballot table in randomized order —
// this is what breaks the timing correlation between a VoterStatus flip and
// a ballot appearing (ARCHITECTURE.md requirement 2). In production this
// runs on a timer (e.g. every 60-90s); tests call it directly to simulate a
// batch tick.
export async function drainBatch(electionId: string, positionId: string) {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.pendingBallot.findMany({ where: { electionId, positionId } });

    const windowStart = new Date();
    const windowEnd = new Date();

    const shuffled = shuffle(pending);
    const publishedHash = createHash("sha256")
      .update(shuffled.map((b) => b.candidateId).sort().join(","))
      .digest("hex");

    const batch = await tx.batch.create({
      data: { electionId, positionId, windowStart, windowEnd, publishedHash, publishedAt: new Date() },
    });

    for (const ballot of shuffled) {
      await tx.ballot.create({
        data: { electionId, positionId, candidateId: ballot.candidateId, batchId: batch.id },
      });
    }

    await tx.pendingBallot.deleteMany({ where: { electionId, positionId } });

    return batch;
  });
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
