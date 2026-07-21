// Shared shape for "flip a piece of shared state exactly once, safely under
// concurrency." See ARCHITECTURE.md's "Atomic conditional updates" section
// for why this exists: this codebase has independently reintroduced the
// unsafe check-then-act version of this (read the row, check a condition,
// then issue a separate UPDATE) twice, in unrelated features. Use this
// instead of `findUnique` + `update`.
//
// The guard condition (e.g. `hasVoted: false`, `usedAt: null`, `revokedAt: null`)
// must live in `where`, not in application code before the call — the database's
// row lock is what makes two concurrent callers unable to both succeed.
export async function conditionalUpdate<W extends object, D extends object>(
  delegate: { updateMany: (args: { where: W; data: D }) => Promise<{ count: number }> },
  where: W,
  data: D,
): Promise<number> {
  const { count } = await delegate.updateMany({ where, data });
  return count;
}
