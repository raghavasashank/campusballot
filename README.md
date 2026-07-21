# CampusBallot

Campus election management, v1 MVP. See [SCOPE.md](SCOPE.md) for what's in/out of v1 and
[ARCHITECTURE.md](ARCHITECTURE.md) for the anonymous-voting design.

## Setup

```bash
npm install
cp .env.example .env   # then edit ALLOWED_EMAIL_DOMAIN, ADMIN_EMAILS, SESSION_SECRET

# starts a persistent local Postgres (real embedded binary, see below) and
# leaves it running in the background
node scripts/dev-db.js

# in another terminal:
npx prisma db push
npm run dev
```

Open http://localhost:3000. Admin emails (from `ADMIN_EMAILS`) land on `/admin`; everyone else
lands on `/vote`. Enter an email on your `ALLOWED_EMAIL_DOMAIN`; the magic link is logged to the
terminal (no email provider wired up yet, see `lib/mailer.ts`).

**Database note:** local dev uses a real embedded Postgres binary (`embedded-postgres`) via
`scripts/dev-db.js`, not `npx prisma dev`. Prisma's own local dev server proved unreliable for
raw connections in this environment (`ECONNRESET` / "Connection terminated unexpectedly" on
repeated or concurrent queries) — verified independently with plain `pg`, not specific to our
code. `scripts/dev-db.js` is idempotent — safe to re-run, it skips re-initializing if
`.pgdata-dev` already has a cluster.

## Tests

```bash
npm test
```

Runs against a separate, ephemeral instance of the same real embedded Postgres binary (see
`tests/globalSetup.ts`), started and torn down automatically — no manual setup needed. This is
what makes the vote-casting race-condition test meaningful: it needs genuine concurrent
connections, which `prisma dev`'s proxy couldn't sustain.

## What's here

**Domain / service layer** (`lib/domain/*`, tested in `tests/*.test.ts`):
- `candidates.ts` — application + admin approve/reject workflow.
- `elections.ts` — lifecycle state machine (draft → scheduled → open → closed →
  results_published), each transition audit-logged.
- `positions.ts` / `eligibility.ts` — adding positions and eligible voters to an election.
- `ballots.ts` — vote casting: atomic one-vote-per-position gate (a conditional `updateMany`
  with `hasVoted: false` in the WHERE clause, not read-then-write — that's what makes it
  race-safe) plus the unlinked `PendingBallot` write, in one transaction. Returns a
  participation receipt that never reveals the candidate chosen.
- `batch.ts` — drains `PendingBallot` into the immutable, shuffled `Ballot` table.
- `results.ts` — tallies `Ballot` rows per candidate once an election is `CLOSED`.
- `audit.ts` — shared append-only audit log writer.
- `notifications.ts` — best-effort email notifications (announcement on schedule, status-change
  on open/close, result-publication) to an election's eligible voters. A send failure never
  rolls back or fails the underlying lifecycle transition.
- `csv.ts` — roster CSV parser (`parseStudentRosterCsv`), tested for duplicate and malformed
  rows; `eligibility.ts`'s `importEligibleVotersFromCsv` wires it into the same eligibility
  path as manual entry.
- `sessions.ts` — admin-facing session revocation (single session or every session for a
  user), audit-logged. Built on `lib/session-store.ts`'s DB-backed `Session` table — sessions
  are looked up (not just decoded from the cookie) on every request, so revocation takes
  effect on the very next request, not on cookie expiry.

**`lib/atomic-guard.ts`** — `conditionalUpdate()`, the shared helper for "flip a piece of shared
state exactly once, safely under concurrency." Used by vote casting, magic-link token
consumption, and session revocation — see ARCHITECTURE.md's "Atomic conditional updates" section
for why this is a codified rule rather than tribal knowledge (this codebase reintroduced the
unsafe read-then-write version of this bug twice before it was).

**Reports** — `GET /api/admin/elections/[id]/turnout/export` and `.../results/export` stream
CSV downloads (`lib/csv-export.ts`) for turnout and final tallies.

**API routes** (`app/api/*`) — thin wrappers over the domain layer, auth-gated via
`lib/auth.ts`'s `requireApiUser(role?)`. Domain errors map to HTTP status codes via
`lib/api-errors.ts`.

**Pages:**
- `app/login` — magic-link sign-in.
- `app/(student)/vote`, `app/(student)/vote/[id]` — election list and voting (candidate
  manifestos + photos, one vote per position, receipt-only confirmation).
- `app/(student)/candidate/apply`, `.../status` — candidate application form (manifesto +
  photo) and status tracker.
- `app/admin`, `app/admin/elections/[id]`, `.../results` — election creation/scheduling,
  positions, eligibility, live turnout, batch processing, results.
- `app/admin/candidates` — approval queue.
- `app/admin/sessions` — active sessions across all users; revoke one or every session for a
  user, effective immediately.
- `app/admin/audit-log` — append-only admin action log viewer.

**Shared UI** (`components/ui/*`) — Button, Card, Badge, PageHeader, EmptyState, Alert,
FormField primitives built on Tailwind (not a component library) for a consistent,
institutional look across all three flows, with dark mode support throughout.

## Not built yet

- The batch worker isn't wired to a timer — `drainBatch` runs on demand via an admin "Process
  pending ballots" button, not on a schedule. Wire up a cron/interval before relying on it for
  a real election with continuous voting.
- No dedicated mobile testing beyond responsive Tailwind classes — the voting flow uses
  stacked cards and large tap targets, but hasn't been checked in a real mobile browser.
- Results are admin-only for now; no student-facing published-results page.
