import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mailer", () => ({ sendEmail: vi.fn() }));

import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import {
  createElectionDraft,
  scheduleElection,
  openElection,
  closeElection,
  publishResults,
} from "@/lib/domain/elections";
import { createUser, resetDb } from "./helpers";

const mockedSendEmail = vi.mocked(sendEmail);

beforeEach(async () => {
  mockedSendEmail.mockClear();
  await resetDb();
});

async function draftElectionWithEligibleVoters(count: number) {
  const admin = await createUser("ADMIN");
  const election = await createElectionDraft(admin.id, "Notify Test Election");
  const voters = await Promise.all(Array.from({ length: count }, () => createUser("VOTER")));
  await prisma.eligibleVoter.createMany({
    data: voters.map((v) => ({ electionId: election.id, userId: v.id })),
  });
  return { admin, election, voters };
}

describe("election-scheduled notifications", () => {
  it("emails every eligible voter when the election is scheduled", async () => {
    const { admin, election, voters } = await draftElectionWithEligibleVoters(2);

    await scheduleElection(admin.id, election.id, new Date(), new Date());

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]).sort();
    expect(recipients).toEqual(voters.map((v) => v.email).sort());
  });

  it("mentions the election name in the subject", async () => {
    const { admin, election } = await draftElectionWithEligibleVoters(1);

    await scheduleElection(admin.id, election.id, new Date(), new Date());

    const [, subject] = mockedSendEmail.mock.calls[0];
    expect(subject).toContain(election.name);
  });

  it("sends nothing when there are no eligible voters yet", async () => {
    const admin = await createUser("ADMIN");
    const election = await createElectionDraft(admin.id, "Empty Election");

    await scheduleElection(admin.id, election.id, new Date(), new Date());

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("does not notify voters from a different election", async () => {
    const { admin, election } = await draftElectionWithEligibleVoters(1);
    const otherElection = await createElectionDraft(admin.id, "Other Election");
    const otherVoter = await createUser("VOTER");
    await prisma.eligibleVoter.create({ data: { electionId: otherElection.id, userId: otherVoter.id } });

    await scheduleElection(admin.id, election.id, new Date(), new Date());

    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]);
    expect(recipients).not.toContain(otherVoter.email);
  });
});

describe("election-opened notifications", () => {
  it("emails eligible voters when voting opens", async () => {
    const { admin, election, voters } = await draftElectionWithEligibleVoters(2);
    await scheduleElection(admin.id, election.id, new Date(), new Date());
    mockedSendEmail.mockClear();

    await openElection(admin.id, election.id);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]).sort();
    expect(recipients).toEqual(voters.map((v) => v.email).sort());
    const [, subject] = mockedSendEmail.mock.calls[0];
    expect(subject.toLowerCase()).toContain("open");
  });
});

describe("election-closed notifications", () => {
  it("emails eligible voters when voting closes", async () => {
    const { admin, election, voters } = await draftElectionWithEligibleVoters(2);
    await scheduleElection(admin.id, election.id, new Date(), new Date());
    await openElection(admin.id, election.id);
    mockedSendEmail.mockClear();

    await closeElection(admin.id, election.id);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]).sort();
    expect(recipients).toEqual(voters.map((v) => v.email).sort());
    const [, subject] = mockedSendEmail.mock.calls[0];
    expect(subject.toLowerCase()).toContain("closed");
  });
});

describe("results-published notifications", () => {
  it("emails eligible voters when results are published", async () => {
    const { admin, election, voters } = await draftElectionWithEligibleVoters(2);
    await scheduleElection(admin.id, election.id, new Date(), new Date());
    await openElection(admin.id, election.id);
    await closeElection(admin.id, election.id);
    mockedSendEmail.mockClear();

    await publishResults(admin.id, election.id);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]).sort();
    expect(recipients).toEqual(voters.map((v) => v.email).sort());
    const [, subject] = mockedSendEmail.mock.calls[0];
    expect(subject.toLowerCase()).toContain("published");
  });

  it("never notifies a voter who was never made eligible for any election", async () => {
    const { admin, election } = await draftElectionWithEligibleVoters(1);
    const bystander = await createUser("VOTER");
    await scheduleElection(admin.id, election.id, new Date(), new Date());

    const recipients = mockedSendEmail.mock.calls.map((call) => call[0]);
    expect(recipients).not.toContain(bystander.email);
  });
});
