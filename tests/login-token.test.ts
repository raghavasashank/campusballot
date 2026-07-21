import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeLoginToken, generateToken } from "@/lib/tokens";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("consumeLoginToken", () => {
  it("returns the user's session info and marks the token used", async () => {
    const user = await createUser("VOTER");
    const { raw, hash, expiresAt } = generateToken();
    await prisma.loginToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

    const session = await consumeLoginToken(raw);

    expect(session).toEqual({ userId: user.id, role: "VOTER" });
    const stored = await prisma.loginToken.findUnique({ where: { tokenHash: hash } });
    expect(stored!.usedAt).not.toBeNull();
  });

  it("rejects a token that's already been used", async () => {
    const user = await createUser("VOTER");
    const { raw, hash, expiresAt } = generateToken();
    await prisma.loginToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

    await consumeLoginToken(raw);
    const second = await consumeLoginToken(raw);

    expect(second).toBeNull();
  });

  it("rejects an expired token", async () => {
    const user = await createUser("VOTER");
    const { raw, hash } = generateToken();
    await prisma.loginToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() - 1000) } });

    expect(await consumeLoginToken(raw)).toBeNull();
  });

  it("rejects a token that never existed", async () => {
    expect(await consumeLoginToken("not-a-real-token")).toBeNull();
  });

  it("allows exactly one of two concurrent consumptions of the same token to succeed", async () => {
    const user = await createUser("VOTER");
    const { raw, hash, expiresAt } = generateToken();
    await prisma.loginToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });

    const [first, second] = await Promise.all([consumeLoginToken(raw), consumeLoginToken(raw)]);

    const succeeded = [first, second].filter((s) => s !== null);
    expect(succeeded).toHaveLength(1);

    const stored = await prisma.loginToken.findUnique({ where: { tokenHash: hash } });
    expect(stored!.usedAt).not.toBeNull();
  });
});
