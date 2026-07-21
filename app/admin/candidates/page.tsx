"use client";

import { useEffect, useState } from "react";
import { Check, UserRound, X } from "lucide-react";
import { PageHeader, Card, Button, CandidateStatusBadge, EmptyState, ErrorAlert } from "@/components/ui";

type CandidateRow = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  status: string;
  applicantEmail: string;
  positionTitle: string;
  electionName: string;
};

const FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export default function AdminCandidatesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("PENDING");
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    const qs = filter === "ALL" ? "" : `?status=${filter}`;
    fetch(`/api/admin/candidates${qs}`).then((res) => res.json()).then(setCandidates);
  };

  useEffect(load, [filter]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/candidates/${id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Candidate Approval Queue" description="Review and decide candidate applications." />
      <ErrorAlert message={error} />

      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === f
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {candidates === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : candidates.length === 0 ? (
        <EmptyState title="Nothing here" description="No candidates match this filter." />
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <Card key={c.id} className="flex items-start gap-4">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt={c.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <UserRound size={20} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-50">{c.name}</span>
                  <CandidateStatusBadge status={c.status} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {c.positionTitle} · {c.electionName} · {c.applicantEmail}
                </p>
                {c.bio && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{c.bio}</p>}
              </div>
              {c.status === "PENDING" && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busyId === c.id} onClick={() => review(c.id, "approve")}>
                    <Check size={14} />
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" disabled={busyId === c.id} onClick={() => review(c.id, "reject")}>
                    <X size={14} />
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
