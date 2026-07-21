import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyAsCandidate, approveCandidate, rejectCandidate } from "@/lib/domain/candidates";
import { DuplicateApplicationError, InvalidTransitionError, NotFoundError } from "@/lib/domain/errors";
import { createElection, createPosition, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("candidate application", () => {
  it("creates a pending candidacy for the applicant", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    const student = await createUser("VOTER");

    const candidate = await applyAsCandidate(student.id, position.id, "Jane Doe", "I care about parking.");

    expect(candidate.status).toBe("PENDING");
    expect(candidate.applicantId).toBe(student.id);
    expect(candidate.reviewedAt).toBeNull();
  });

  it("rejects a second application from the same student for the same position", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    const student = await createUser("VOTER");
    await applyAsCandidate(student.id, position.id, "Jane Doe");

    await expect(applyAsCandidate(student.id, position.id, "Jane Doe again")).rejects.toThrow(
      DuplicateApplicationError,
    );
  });
});

describe("candidate approval", () => {
  it("approves a pending candidate and logs the admin action", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    const student = await createUser("VOTER");
    const admin = await createUser("ADMIN");
    const candidate = await applyAsCandidate(student.id, position.id, "Jane Doe");

    const approved = await approveCandidate(admin.id, candidate.id);

    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedAt).not.toBeNull();

    const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, target: candidate.id } });
    expect(entry).not.toBeNull();
    expect(entry!.action).toBe("APPROVE_CANDIDATE");
  });

  it("rejects a pending candidate and logs the admin action", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    const student = await createUser("VOTER");
    const admin = await createUser("ADMIN");
    const candidate = await applyAsCandidate(student.id, position.id, "Jane Doe");

    const rejected = await rejectCandidate(admin.id, candidate.id);

    expect(rejected.status).toBe("REJECTED");
    const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, target: candidate.id } });
    expect(entry!.action).toBe("REJECT_CANDIDATE");
  });

  it("refuses to re-approve a candidate that was already decided", async () => {
    const election = await createElection();
    const position = await createPosition(election.id);
    const student = await createUser("VOTER");
    const admin = await createUser("ADMIN");
    const candidate = await applyAsCandidate(student.id, position.id, "Jane Doe");
    await approveCandidate(admin.id, candidate.id);

    await expect(approveCandidate(admin.id, candidate.id)).rejects.toThrow(InvalidTransitionError);
  });

  it("throws NotFoundError for an unknown candidate id", async () => {
    const admin = await createUser("ADMIN");
    await expect(approveCandidate(admin.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      NotFoundError,
    );
  });
});
