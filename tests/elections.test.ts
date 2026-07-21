import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeElection, createElectionDraft, openElection, publishResults, scheduleElection } from "@/lib/domain/elections";
import { InvalidTransitionError } from "@/lib/domain/errors";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("election lifecycle", () => {
  it("creates a new election in DRAFT and logs the admin action", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");

    expect(election.status).toBe("DRAFT");

    const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, target: election.id } });
    expect(entry!.action).toBe("CREATE_ELECTION");
  });

  it("walks the full lifecycle: draft -> scheduled -> open -> closed -> results_published", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");

    const opensAt = new Date(Date.now() + 1000 * 60 * 60);
    const closesAt = new Date(Date.now() + 1000 * 60 * 60 * 2);

    const scheduled = await scheduleElection(admin.id, election.id, opensAt, closesAt);
    expect(scheduled.status).toBe("SCHEDULED");

    const opened = await openElection(admin.id, election.id);
    expect(opened.status).toBe("OPEN");

    const closed = await closeElection(admin.id, election.id);
    expect(closed.status).toBe("CLOSED");

    const published = await publishResults(admin.id, election.id);
    expect(published.status).toBe("RESULTS_PUBLISHED");
  });

  it("rejects out-of-order transitions, e.g. opening a draft election directly", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");

    await expect(openElection(admin.id, election.id)).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects closing an election that never opened", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");
    await scheduleElection(admin.id, election.id, new Date(), new Date());

    await expect(closeElection(admin.id, election.id)).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects publishing results before the election is closed", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");
    await scheduleElection(admin.id, election.id, new Date(), new Date());
    await openElection(admin.id, election.id);

    await expect(publishResults(admin.id, election.id)).rejects.toThrow(InvalidTransitionError);
  });

  it("logs every lifecycle transition as a separate audit entry", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Spring 2027 Senate");
    await scheduleElection(admin.id, election.id, new Date(), new Date());
    await openElection(admin.id, election.id);
    await closeElection(admin.id, election.id);
    await publishResults(admin.id, election.id);

    const entries = await prisma.auditLog.findMany({
      where: { target: election.id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => e.action)).toEqual([
      "CREATE_ELECTION",
      "SCHEDULE_ELECTION",
      "OPEN_ELECTION",
      "CLOSE_ELECTION",
      "PUBLISH_RESULTS",
    ]);
  });
});
