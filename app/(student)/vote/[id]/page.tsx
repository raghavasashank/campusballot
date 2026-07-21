"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader, Card, Button, EmptyState, ErrorAlert } from "@/components/ui";

type Candidate = { id: string; name: string; bio: string | null; photoUrl: string | null };
type Position = { id: string; title: string; candidates: Candidate[]; hasVoted: boolean; isEligible?: boolean };
type ElectionDetail = { id: string; name: string; status: string; positions: Position[] };

export default function ElectionVotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, { receiptId: string; votedAt: string }>>({});

  const load = () => {
    fetch(`/api/elections/${id}`)
      .then((res) => res.json())
      .then(setElection)
      .catch(() => setError("Couldn't load this election."));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <>
        <PageHeader title="Election" />
        <ErrorAlert message={error} />
      </>
    );
  }
  if (!election) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;

  return (
    <>
      <PageHeader title={election.name} description="Cast your vote for each position below." />
      {election.status !== "OPEN" ? (
        <EmptyState title="Voting isn't open" description="This election isn't currently accepting votes." />
      ) : (
        <div className="space-y-6">
          {election.positions.map((position) => (
            <PositionBallot
              key={position.id}
              position={position}
              receipt={receipts[position.id]}
              onVoted={(receipt) => {
                setReceipts((r) => ({ ...r, [position.id]: receipt }));
                load();
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PositionBallot({
  position,
  receipt,
  onVoted,
}: {
  position: Position;
  receipt?: { receiptId: string; votedAt: string };
  onVoted: (receipt: { receiptId: string; votedAt: string }) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (position.isEligible === false) {
    return (
      <Card>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">{position.title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          You&apos;re not on the eligibility list for this position.
        </p>
      </Card>
    );
  }

  if (position.hasVoted || receipt) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-50">{position.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your vote was recorded.</p>
            {receipt && (
              <p className="mt-2 font-mono text-xs text-slate-400 dark:text-slate-500">
                Receipt: {receipt.receiptId.slice(0, 8)} · {new Date(receipt.votedAt).toLocaleString()}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              This receipt confirms you participated — it doesn&apos;t show who you voted for, so no one can prove
              your choice to anyone else.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (position.candidates.length === 0) {
    return (
      <Card>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">{position.title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No approved candidates yet.</p>
      </Card>
    );
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: position.id, candidateId: selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Vote failed.");
      onVoted(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="font-medium text-slate-900 dark:text-slate-50">{position.title}</h3>
      <ErrorAlert message={error} />
      <div className="mt-3 space-y-2">
        {position.candidates.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
              selected === c.id
                ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-800"
                : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            }`}
          >
            <input
              type="radio"
              name={`position-${position.id}`}
              className="mt-1"
              checked={selected === c.id}
              onChange={() => setSelected(c.id)}
            />
            <div className="flex flex-1 gap-3">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt={c.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <UserRound size={20} />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">{c.name}</p>
                {c.bio && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{c.bio}</p>}
              </div>
            </div>
          </label>
        ))}
      </div>
      <Button className="mt-4 w-full sm:w-auto" disabled={!selected || submitting} onClick={submit}>
        <CheckCircle2 size={16} />
        {submitting ? "Submitting…" : "Cast Vote"}
      </Button>
    </Card>
  );
}
