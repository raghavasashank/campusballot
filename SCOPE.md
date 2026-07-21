# CampusBallot — v1 Scope (Single Institution MVP)

> Note: this scope was drafted from conversation context (brainstorm + architecture council session)
> before the full original idea doc was reviewed line-by-line. Revisit against the original doc when
> available — treat this as a working baseline, not a final sign-off.

## MVP (v1 — build this)
- **Student/eligibility management**: import or maintain an eligible-voter list per election
  (institutional email as identity key).
- **Candidate management**: create candidates per position, per election.
- **Election lifecycle**: create election → define positions/candidates → open voting window →
  close → publish results. Single election active at a time is acceptable for v1.
- **Anonymous voting**: one ballot per student per position, enforced by an atomic
  `has_voted` gate (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Ballot unlinkability**: batched, shuffled ballot insertion so that not even an admin with raw
  DB/backup access can correlate a ballot to a student via timing or row order. This was upgraded
  from "nice to have" to **required v1 infrastructure** after the architecture council session —
  the naive "same transaction, two tables" design does not actually satisfy this on its own.
- **Public auditability / bulletin board**: publish a hash chain of ballots after each batch and at
  close, to a channel the admin doesn't solely control, plus a per-voter lookup receipt. Also
  upgraded into v1 scope — without this, the system has no independent verifiability at all.
- **Basic results view**: tally per position, visible after close.
- **Admin audit log**: every state-changing admin action (create election, add/remove candidate,
  close voting, publish results) is written to an append-only log visible to admins. This exists
  specifically to compensate for merging admin roles (see Roles below), not as a general feature.
- **Auth**: institutional email + magic link (passwordless). Domain-allowlist alone is not
  sufficient — pair it with a magic link sent to the actual address so it's real verification, not
  a string match. No password storage, no full SSO/SAML/OIDC integration in v1.

## Phase 2 (explicitly deferred, not in v1)
- Separate Super Admin / Election Admin roles with real permission separation.
- Real SSO integration (SAML/OIDC) with the institution's identity provider.
- Notifications (email/SMS reminders, turnout nudges).
- Results analytics/dashboards beyond a basic tally view.
- Multiple concurrent elections.
- Configurable batch-window tuning based on observed turnout patterns.
- Dispute-resolution workflow for a student who claims their receipt isn't in the published list.

## Not doing (out of scope, no near-term plan)
- Multi-college / multi-tenant SaaS.
- Blockchain-based verification.
- ERP integration.
- Receipt-freeness / coercion-resistance guarantees (e.g., mixnets, homomorphic tallying). The v1
  bulletin-board design has a known, accepted limitation here — see ARCHITECTURE.md — considered
  acceptable given the low real-world coercion economy of student elections. Revisit if CampusBallot
  is ever used for higher-stakes votes.
- Issued voting tokens, blind signatures, cryptographic commit-reveal protocols. Evaluated and
  rejected in favor of batched/shuffled ballot insertion — see ARCHITECTURE.md for the reasoning.

## Roles (v1)
Two functional roles, not three:
- **Admin** — merged "Admin" + "Super Admin" from the original doc. Can create elections, manage
  candidates and eligibility lists, open/close voting, and publish results. Every state-changing
  action is written to the append-only audit log — this is the accountability mechanism that
  substitutes for a separate Super Admin role, rather than a second role with its own permission
  surface.
- **Voter (Student)** — authenticates via institutional email + magic link, votes once per
  position per election, can look up their own receipt post-election.

Separation of duties (e.g., a distinct election-commission role that can't unilaterally publish
results) is deferred to Phase 2. If the institution needs it sooner, it's a relatively contained
addition — a second role gated on the same permission checks — not a data model rewrite.

## Minimum data model (v1)
See [ARCHITECTURE.md](ARCHITECTURE.md) for the full schema and the reasoning behind it. Core
entities:
- `elections`, `positions`, `candidates`
- `eligible_voters` (per election)
- `voter_status` (has-voted gate, per election/position/student — never joined to ballot content)
- `pending_ballots` → `ballots` (batched, shuffled, UUID-keyed, no student reference)
- `batches` (publishes hash chain per batch window)
- `audit_log` (admin actions)

## Auth approach (v1)
Institutional email + magic link:
- Verify the email domain matches the institution's allowlist.
- Send a one-time link/OTP to that address; no passwords stored.
- No SAML/OIDC integration in v1 — this is the explicit tradeoff that keeps auth simple while still
  proving control of the institutional mailbox.
