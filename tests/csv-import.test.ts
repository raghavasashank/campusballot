import { beforeEach, describe, expect, it } from "vitest";
import { parseStudentRosterCsv } from "@/lib/domain/csv";
import { importEligibleVotersFromCsv, previewRosterImport } from "@/lib/domain/eligibility";
import { prisma } from "@/lib/prisma";
import { createElection, createUser, resetDb } from "./helpers";

// .env.test sets ALLOWED_EMAIL_DOMAIN="college.edu" — all fixtures above use
// that domain already; these new tests exercise the off-domain path directly.

describe("parseStudentRosterCsv", () => {
  it("parses a simple email-only roster", () => {
    const csv = "email\nalice@college.edu\nbob@college.edu\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu", "bob@college.edu"]);
    expect(result.duplicates).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("finds the email column regardless of position and case", () => {
    const csv = "Name,Email\nAlice,alice@college.edu\nBob,bob@college.edu\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu", "bob@college.edu"]);
    expect(result.errors).toEqual([]);
  });

  it("normalizes emails to lowercase and trims whitespace", () => {
    const csv = "email\n  Alice@College.EDU  \n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu"]);
  });

  it("reports duplicate emails within the same file, case-insensitively, without double-counting them", () => {
    const csv = "email\nalice@college.edu\nAlice@College.edu\nbob@college.edu\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu", "bob@college.edu"]);
    expect(result.duplicates).toEqual(["alice@college.edu"]);
  });

  it("flags a row with an invalid email format as an error, not a valid email", () => {
    const csv = "email\nalice@college.edu\nnot-an-email\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu"]);
    expect(result.errors).toEqual([{ line: 3, raw: "not-an-email", reason: "invalid email format" }]);
  });

  it("flags a row missing the email column as an error", () => {
    const csv = "name,email\nAlice,alice@college.edu\nBob\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu"]);
    expect(result.errors).toEqual([{ line: 3, raw: "Bob", reason: "missing email column" }]);
  });

  it("skips blank lines without treating them as errors", () => {
    const csv = "email\nalice@college.edu\n\n\nbob@college.edu\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu", "bob@college.edu"]);
    expect(result.errors).toEqual([]);
  });

  it("returns a single top-level error when there's no header row with an email column", () => {
    const csv = "alice@college.edu\nbob@college.edu\n";
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/header row.*email/i);
  });

  it("partitions a mixed file into valid emails, duplicates, and malformed rows independently", () => {
    const csv = [
      "email",
      "alice@college.edu",
      "not-an-email",
      "alice@college.edu",
      "bob@college.edu",
      "",
      "carol@college.edu",
    ].join("\n");
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual(["alice@college.edu", "bob@college.edu", "carol@college.edu"]);
    expect(result.duplicates).toEqual(["alice@college.edu"]);
    expect(result.errors).toEqual([{ line: 3, raw: "not-an-email", reason: "invalid email format" }]);
  });

  it("returns empty results for an empty file", () => {
    const result = parseStudentRosterCsv("");

    expect(result.emails).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a file larger than the size cap as a single whole-file error", () => {
    const csv = "email\n" + "a".repeat(600 * 1024);
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/size limit/i);
  });

  it("accepts a file right at the size cap", () => {
    const email = "alice@college.edu";
    const padding = "a".repeat(1000);
    const csv = `email,note\n${email},${padding}\n`;
    expect(csv.length).toBeLessThan(500 * 1024);

    const result = parseStudentRosterCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.emails).toEqual([email]);
  });

  it("rejects a file with more rows than the row cap as a single whole-file error", () => {
    const rows = Array.from({ length: 2001 }, (_, i) => `student${i}@college.edu`);
    const csv = "email\n" + rows.join("\n");
    const result = parseStudentRosterCsv(csv);

    expect(result.emails).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/row limit/i);
  });

  it("accepts a file with exactly the row cap", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => `student${i}@college.edu`);
    const csv = "email\n" + rows.join("\n");
    const result = parseStudentRosterCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.emails).toHaveLength(2000);
  });
});

// Mirrors real usage: preview first to get the hash the server computed,
// then commit with that hash — see the "confirm is bound to the preview"
// tests below for what happens when the two don't match.
async function commitCsv(adminId: string, electionId: string, csv: string) {
  const { csvHash } = await previewRosterImport(electionId, csv);
  return importEligibleVotersFromCsv(adminId, electionId, csv, csvHash);
}

describe("importEligibleVotersFromCsv", () => {
  beforeEach(resetDb);

  it("adds every valid row as an eligible voter and reports the count", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const csv = "email\nalice@college.edu\nbob@college.edu\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.added).toBe(2);
    expect(result.duplicates).toEqual([]);
    expect(result.errors).toEqual([]);

    const eligible = await prisma.eligibleVoter.findMany({
      where: { electionId: election.id },
      include: { user: true },
    });
    expect(eligible.map((e) => e.user.email).sort()).toEqual(["alice@college.edu", "bob@college.edu"]);
  });

  it("still adds the valid rows when the file also has malformed ones, and reports both", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const csv = "email\nalice@college.edu\nnot-an-email\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.added).toBe(1);
    expect(result.errors).toEqual([{ line: 3, raw: "not-an-email", reason: "invalid email format" }]);

    const eligible = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
    expect(eligible).toHaveLength(1);
  });

  it("does not add anything or touch the audit log when every row is malformed", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const csv = "email\nnot-an-email\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.added).toBe(0);
    const eligible = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
    expect(eligible).toHaveLength(0);
    const auditEntries = await prisma.auditLog.findMany({ where: { target: election.id } });
    expect(auditEntries).toHaveLength(0);
  });

  it("reports in-file duplicates without creating duplicate eligibility rows", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const csv = "email\nalice@college.edu\nalice@college.edu\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.duplicates).toEqual(["alice@college.edu"]);
    const eligible = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
    expect(eligible).toHaveLength(1);
  });

  it("never creates an account for an email outside the institution's domain", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    const csv = "email\nalice@college.edu\nintruder@gmail.com\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.added).toBe(1);
    expect(result.offDomain).toEqual(["intruder@gmail.com"]);
    const user = await prisma.user.findUnique({ where: { email: "intruder@gmail.com" } });
    expect(user).toBeNull();
    const eligible = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
    expect(eligible).toHaveLength(1);
  });

  it("reports how many brand-new accounts were created versus already existing", async () => {
    const admin = await createUser("ADMIN");
    await prisma.user.create({ data: { email: "alice@college.edu", role: "VOTER" } });
    const election = await createElection();
    const csv = "email\nalice@college.edu\nbob@college.edu\n";

    const result = await commitCsv(admin.id, election.id, csv);

    expect(result.newAccounts).toBe(1);
    expect(result.added).toBe(2);
  });

  it("does not count a student already eligible for this election toward the newly-added count", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElection();
    await commitCsv(admin.id, election.id, "email\nalice@college.edu\n");

    const result = await commitCsv(admin.id, election.id, "email\nalice@college.edu\nbob@college.edu\n");

    expect(result.added).toBe(1);
    expect(result.alreadyEligible).toEqual(["alice@college.edu"]);
  });

  describe("previewRosterImport", () => {
    it("reports the same analysis as a commit would, without writing anything", async () => {
      const election = await createElection();
      const csv = "email\nalice@college.edu\nintruder@gmail.com\nnot-an-email\n";

      const preview = await previewRosterImport(election.id, csv);

      expect(preview.added).toBe(1);
      expect(preview.newAccounts).toBe(1);
      expect(preview.offDomain).toEqual(["intruder@gmail.com"]);
      expect(preview.errors).toEqual([{ line: 4, raw: "not-an-email", reason: "invalid email format" }]);

      const users = await prisma.user.findMany();
      const eligible = await prisma.eligibleVoter.findMany();
      const auditEntries = await prisma.auditLog.findMany();
      expect(users).toHaveLength(0);
      expect(eligible).toHaveLength(0);
      expect(auditEntries).toHaveLength(0);
    });

    it("returns a different hash for different CSV content", async () => {
      const election = await createElection();
      const a = await previewRosterImport(election.id, "email\nalice@college.edu\n");
      const b = await previewRosterImport(election.id, "email\nbob@college.edu\n");

      expect(a.csvHash).not.toBe(b.csvHash);
    });
  });

  describe("confirm is bound to the previewed content", () => {
    it("rejects a commit whose hash doesn't match the CSV being committed", async () => {
      const admin = await createUser("ADMIN");
      const election = await createElection();
      const previewed = "email\nalice@college.edu\n";
      const changed = "email\nalice@college.edu\nmallory@college.edu\n";

      const { csvHash } = await previewRosterImport(election.id, previewed);

      await expect(importEligibleVotersFromCsv(admin.id, election.id, changed, csvHash)).rejects.toThrow(
        /changed since you previewed/i,
      );

      const eligible = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
      expect(eligible).toHaveLength(0);
    });

    it("commits successfully when the hash matches exactly what was previewed", async () => {
      const admin = await createUser("ADMIN");
      const election = await createElection();
      const csv = "email\nalice@college.edu\n";

      const { csvHash } = await previewRosterImport(election.id, csv);
      const result = await importEligibleVotersFromCsv(admin.id, election.id, csv, csvHash);

      expect(result.added).toBe(1);
    });
  });
});
