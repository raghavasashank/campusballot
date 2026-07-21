# CampusBallot — Voting Anonymity & Auditability Architecture

Decided via LLM Council review (5 independent advisors + peer review + chairman synthesis) on 2026-07-21.
Stack assumption: Next.js + Postgres, single institution, no blockchain.

## Requirements being solved
1. Each eligible student can cast at most one ballot per election/position.
2. Not even an admin with full DB/backup access can link a cast ballot back to the student who cast it.
3. The final tally is independently auditable/verifiable by students and observers.

## Why the naive "single transaction, two tables" approach isn't enough
Marking `has_voted = true` and inserting an unlinked ballot row in one DB transaction stops a `JOIN`,
but it does not stop *correlation*. Postgres WAL entries, backup snapshots, autovacuum artifacts, and
sequential row IDs all preserve enough timing/ordering information that an admin with raw DB or backup
access can match "student X flipped to has_voted at 14:32:07.113" to "ballot row inserted at
14:32:07.114" by simple proximity — especially in a low-traffic election where votes trickle in one at
a time. Same-transaction atomicity solves requirement 1's data integrity, not requirement 2's
unlinkability.

Tokens, blind signatures, and commit-reveal schemes were evaluated and rejected for v1: they solve the
same problem with meaningfully more implementation surface (a separate token authority, redemption
flow, or cryptographic protocol) for a two-person team with no dedicated security staff. Complexity
itself is a liability here — a scheme nobody on the team can explain to a skeptical student in three
sentences is a scheme that's hard to audit and easy to misimplement.

## Recommended architecture

### 1. Instant, atomic gate — solves requirement 1
On vote submission, in one transaction:
- Check eligibility and current `has_voted` state for `(election_id, position_id, student_id)`.
- Flip `has_voted = true`, guarded by a unique constraint on `(election_id, position_id, student_id)`.

This step stays synchronous and immediate. It is the only thing responsible for preventing double
voting — nothing about the anonymity fix below should weaken or bypass it.

### 2. Delayed, shuffled ballot insertion — solves requirement 2
- The ballot (candidate choice only, no student reference) is written immediately into a
  `pending_ballots` queue.
- A batch worker (cron, every 60–90 seconds) pulls everything accumulated since the last run,
  shuffles it in application memory, and inserts it into the immutable `ballots` table in randomized
  order.
- Ballots use random UUID primary keys (never sequential IDs), and their stored timestamp is truncated
  to the batch window, not per-row precision.
- This breaks the timing/ordering correlation that defeats the naive same-transaction design, without
  needing tokens or blind signatures.
- **Known accepted limitation for v1:** if turnout is extremely low (e.g., 1–2 votes in a batch
  window), correlation is still possible in principle. This should be monitored; if real turnout data
  shows sparse voting periods, widen the batch window or hold ballots until a minimum batch size is
  reached before flushing.

### 3. Public bulletin board — solves requirement 3
- After each batch flush, and again at election close, compute a hash chain (or Merkle root) over the
  `ballots` table contents and publish it to at least one channel the admin does not solely control —
  e.g., a public URL plus an emailed digest to a designated non-admin "election observer" role
  (student senate advisor, etc.). A single admin should not be able to quietly regenerate and
  republish history undetected.
- Each voter receives an opaque receipt (their ballot's UUID or a commitment hash) at vote time, which
  they can look up post-election to confirm their ballot is included in the published list.

### 4. Explicit non-mitigated risk: receipt-freeness / coercion
A receipt that lets a voter prove their ballot was counted, combined with a public ballot list that
shows candidate choice per ballot, means a voter *can* prove to a third party how they voted. This is
a known, unsolved limitation of simple bulletin-board schemes without heavier cryptography (mixnets,
homomorphic tallying). For v1, this is an **accepted risk**, on the judgment that low-stakes student
elections have a low real-world coercion/vote-buying economy — but it must be documented as a known
limitation, not silently ignored, and should be revisited if CampusBallot is ever used for
higher-stakes votes.

### 5. Auth/session log hygiene
Login and session logs (SSO logs, IP addresses, per-request timestamps) are a deanonymization channel
outside the ballot schema entirely. Do not log per-vote IP addresses or session timestamps in any
store that could be joined back to a batch window. This is a process/config requirement, not a schema
one — call it out in the deployment checklist.

## Minimal schema

```sql
elections (
  id, name, opens_at, closes_at, status
)

positions (
  id, election_id, title
)

candidates (
  id, position_id, name, bio
)

eligible_voters (
  id, election_id, student_id,
  unique(election_id, student_id)
)

voter_status (
  id, election_id, position_id, student_id,
  has_voted boolean default false,
  unique(election_id, position_id, student_id)
)

pending_ballots (        -- ephemeral queue, drained by batch worker
  id uuid, election_id, position_id, candidate_id,
  queued_at
)

ballots (                -- immutable, no student reference, randomized insertion order
  id uuid primary key,   -- random UUID, never sequential
  election_id, position_id, candidate_id,
  batch_id,
  batch_window_start, batch_window_end   -- truncated precision, not per-row
)

batches (
  id, election_id, position_id,
  window_start, window_end,
  published_hash, published_at
)

audit_log (              -- admin action log (see SCOPE.md — merged Admin role)
  id, actor_admin_id, action, target, created_at
)
```

## Atomic conditional updates — a codebase-wide concurrency rule

This codebase independently reintroduced the same concurrency bug twice, in unrelated features,
before it was codified as a rule: **never guard a one-time state transition with a
read-then-write** (`findUnique` to check a condition, then a separate `update` call). Two
concurrent callers can both pass the check before either write commits, and both "succeed" at
something that was supposed to happen exactly once.

- **First occurrence**: the original `castVote` vote-casting gate (`VoterStatus.hasVoted`) was
  built correctly from the start as a conditional `updateMany`, precisely because double-voting
  was the headline risk everyone was already watching for.
- **Second occurrence**: the magic-link `verify` endpoint's token consumption was *not* built
  this way initially — it did `findUnique` (check `usedAt` is null) then a separate `update`.
  Caught by a follow-up security review, specifically because it was the exact bug shape #1 had
  already avoided, just in a different feature nobody had re-checked. Fixed by extracting
  `consumeLoginToken()` in `lib/tokens.ts`.
- **Third occurrence, avoided proactively**: when server-side session revocation was added, the
  same pattern was applied deliberately from the start (`revokeSessionRecord`,
  `revokeAllSessionRecordsForUser` in `lib/session-store.ts`), specifically because of the
  history above.

**The rule, and the helper that encodes it**: any state transition on a shared, mutable row that
must happen at most once — or where the caller needs to know whether *this specific call* was the
one that made it happen — goes through `lib/atomic-guard.ts`'s `conditionalUpdate(delegate, where,
data)`. The guard condition (`hasVoted: false`, `usedAt: null`, `revokedAt: null`, etc.) must be in
`where`, never checked separately beforehand — the database's row lock is what makes two
concurrent callers unable to both succeed, and `count` in the return value tells you whether this
call was the one that won. Current uses: `castVote`'s `VoterStatus` flip, `consumeLoginToken`'s
`LoginToken` consumption, `revokeSessionRecord` / `revokeAllSessionRecordsForUser`'s `Session`
revocation.

Every one of these has a concurrency regression test that fires the operation twice
simultaneously and asserts exactly one succeeds (see `tests/voting.test.ts`,
`tests/login-token.test.ts`, `tests/session-store.test.ts`) — a state transition using this
pattern without that test alongside it should be treated as incomplete, not just unverified.

**Related but distinct: the CSV roster preview/confirm hash binding.** This solves a different
problem — not "did two callers race," but "does the content being committed match the content
that was previewed" — via a server-computed hash the client must echo back, not via
`conditionalUpdate`. Don't conflate the two: hash-binding prevents committing stale/changed
content; atomic conditional updates prevent double-processing a one-time transition. A feature
might need either, both, or neither, depending on what it's actually guarding against.

## Known limitations outside the voting design

- **Rate limiter is single-process, in-memory** (`lib/rate-limit.ts`, used to throttle
  `/api/auth/request-link` and stop email-bombing a student's inbox). It's a plain `Map`, keyed and
  counted per Node process. This is correct and sufficient for a v1 single-instance deployment, but it
  silently stops working as a real limit the moment this runs as more than one process/pod behind a
  load balancer — each instance would enforce the limit independently, so the effective limit becomes
  (per-instance limit × instance count). If CampusBallot ever moves to a multi-instance deployment,
  swap this for a shared store (Redis/Upstash) before relying on it — don't assume it degrades
  gracefully, it just quietly becomes less effective.

- **Email sender is an unauthenticated free-domain address** (`campusballot.noreply@gmail.com` via
  Brevo's shared sending infrastructure, no custom domain). Gmail/Yahoo/Outlook's 2024+ bulk-sender
  requirements treat mail from an unauthenticated free domain as suspicious regardless of which
  relay sends it (confirmed hitting this with direct SMTP, Resend, and Brevo in turn) — expect
  intermittent deferrals, rate-limiting (`421-4.7.28` from Gmail), or silent drops, worse under
  burst volume (many students signing in around the same time is exactly the pattern that trips
  it hardest). Accepted for now during testing; **before running a real election**, buy a cheap
  domain (~$10-15/yr) and authenticate it in Brevo (SPF/DKIM/DMARC) — an authenticated sender has
  its own reputation with Gmail/Yahoo/Outlook and isn't affected by this. Since student email is
  `@aurora.edu.in`, likely itself hosted on Google Workspace or Microsoft 365, this restriction
  plausibly applies to real recipients too, not just the Gmail account used for testing — don't
  assume it's only a test-account problem.

## Rejected alternatives (for reference)
- **Single-use voting tokens** (issue token at auth, redeem later): correctly solves the same timing
  problem as batching, but adds a separate token-issuance/redemption subsystem. Not worth the added
  surface area over batched-shuffle-insert for v1.
- **Blind signatures**: cryptographically clean, but the same admin who could run a signing server can
  log what they sign before blinding — doesn't fully solve the insider-threat model anyway, and is not
  explainable to a non-expert auditor. Rejected for v1.
- **Hashed commit-reveal**: solves verifiability (requirement 3) more than anonymity (requirement 2);
  the batching + hash-chain approach above already captures the useful part of this without a
  separate reveal phase.
