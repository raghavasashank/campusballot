import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

// Best-effort: a notification failure must never roll back or fail the
// underlying state transition, so every send is wrapped and logged, not thrown.
async function notifyEligibleVoters(electionId: string, subject: string, body: string) {
  const eligible = await prisma.eligibleVoter.findMany({
    where: { electionId },
    include: { user: { select: { email: true } } },
  });

  await Promise.all(
    eligible.map(async ({ user }) => {
      try {
        await sendEmail(user.email, subject, body);
      } catch (err) {
        console.error(`Failed to notify ${user.email}:`, err);
      }
    }),
  );
}

export async function notifyElectionScheduled(electionId: string, name: string, opensAt: Date, closesAt: Date) {
  await notifyEligibleVoters(
    electionId,
    `${name}: election scheduled`,
    `Voting for "${name}" opens ${opensAt.toLocaleString()} and closes ${closesAt.toLocaleString()}.`,
  );
}

export async function notifyElectionOpened(electionId: string, name: string) {
  await notifyEligibleVoters(electionId, `${name}: voting is open`, `Voting for "${name}" is now open. Cast your vote before it closes.`);
}

export async function notifyElectionClosed(electionId: string, name: string) {
  await notifyEligibleVoters(electionId, `${name}: voting has closed`, `Voting for "${name}" has closed. Results will be announced separately.`);
}

export async function notifyResultsPublished(electionId: string, name: string) {
  await notifyEligibleVoters(electionId, `${name}: results published`, `Results for "${name}" have been published.`);
}
