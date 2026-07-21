import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/domain/audit";
import { NotFoundError, StaleImportError } from "@/lib/domain/errors";
import { parseStudentRosterCsv } from "@/lib/domain/csv";

function hashCsv(csv: string): string {
  return createHash("sha256").update(csv).digest("hex");
}

// Adds students to an election's eligibility list and creates their
// VoterStatus gate row for every position already on the election — see
// ARCHITECTURE.md: the vote-casting gate only ever UPDATEs an existing
// VoterStatus row, it never creates one, so eligibility must be seeded here.
export async function addEligibleVoters(adminId: string, electionId: string, emails: string[]) {
  return prisma.$transaction(async (tx) => {
    const election = await tx.election.findUnique({
      where: { id: electionId },
      include: { positions: true },
    });
    if (!election) throw new NotFoundError("Election not found.");

    const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];

    const users = await Promise.all(
      normalized.map((email) =>
        tx.user.upsert({ where: { email }, update: {}, create: { email, role: "VOTER" } }),
      ),
    );

    await tx.eligibleVoter.createMany({
      data: users.map((user) => ({ electionId, userId: user.id })),
      skipDuplicates: true,
    });

    if (election.positions.length > 0) {
      await tx.voterStatus.createMany({
        data: users.flatMap((user) =>
          election.positions.map((position) => ({
            electionId,
            positionId: position.id,
            userId: user.id,
          })),
        ),
        skipDuplicates: true,
      });
    }

    await logAction(tx, adminId, "ADD_ELIGIBLE_VOTERS", electionId);
    return users;
  });
}

export type RosterImportSummary = {
  csvHash: string;
  added: number;
  newAccounts: number;
  alreadyEligible: string[];
  offDomain: string[];
  duplicates: string[];
  errors: { line: number; raw: string; reason: string }[];
};

// Parses + analyzes a roster CSV without writing anything — shared by the
// preview and commit paths so they can never disagree. Off-domain emails
// (outside ALLOWED_EMAIL_DOMAIN) are never candidates for account creation,
// full stop — this is what closes the "any string that looks like an email
// gets a permanent account" gap from the security review.
async function analyzeRoster(electionId: string, csv: string) {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) throw new NotFoundError("Election not found.");

  const parsed = parseStudentRosterCsv(csv);
  const domainSuffix = `@${(process.env.ALLOWED_EMAIL_DOMAIN ?? "").toLowerCase()}`;

  const onDomain: string[] = [];
  const offDomain: string[] = [];
  for (const email of parsed.emails) {
    (email.endsWith(domainSuffix) ? onDomain : offDomain).push(email);
  }

  const existingUsers = onDomain.length > 0 ? await prisma.user.findMany({ where: { email: { in: onDomain } } }) : [];
  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const newAccounts = onDomain.filter((e) => !existingEmails.has(e)).length;

  const existingUserIds = existingUsers.map((u) => u.id);
  const existingEligible =
    existingUserIds.length > 0
      ? await prisma.eligibleVoter.findMany({
          where: { electionId, userId: { in: existingUserIds } },
          include: { user: true },
        })
      : [];
  const alreadyEligibleEmails = new Set(existingEligible.map((ev) => ev.user.email));

  const alreadyEligible = onDomain.filter((e) => alreadyEligibleEmails.has(e));
  const toAdd = onDomain.filter((e) => !alreadyEligibleEmails.has(e));

  const summary: RosterImportSummary = {
    csvHash: hashCsv(csv),
    added: toAdd.length,
    newAccounts,
    alreadyEligible,
    offDomain,
    duplicates: parsed.duplicates,
    errors: parsed.errors,
  };

  return { onDomain, summary };
}

// Dry run: read-only, no writes, no audit log — lets an admin see exactly
// how many new accounts an import would create before committing to it.
export async function previewRosterImport(electionId: string, csv: string): Promise<RosterImportSummary> {
  const { summary } = await analyzeRoster(electionId, csv);
  return summary;
}

// Commit: same analysis, then actually performs the import via
// addEligibleVoters (which already dedupes against the DB and creates
// VoterStatus rows). `expectedHash` must match the hash returned by the
// preview the admin actually looked at — otherwise the commit could write
// content the admin never reviewed (a stale tab, a re-exported roster
// mid-review). This is a server-enforced guarantee, not just a UI nicety.
export async function importEligibleVotersFromCsv(
  adminId: string,
  electionId: string,
  csv: string,
  expectedHash: string,
): Promise<RosterImportSummary> {
  const { onDomain, summary } = await analyzeRoster(electionId, csv);
  if (summary.csvHash !== expectedHash) {
    throw new StaleImportError(
      "The roster file has changed since you previewed it. Please preview again before confirming.",
    );
  }
  if (onDomain.length > 0) {
    await addEligibleVoters(adminId, electionId, onDomain);
  }
  return summary;
}
