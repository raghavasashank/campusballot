"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Vote as VoteIcon } from "lucide-react";
import { PageHeader, Card, EmptyState, ElectionStatusBadge, ErrorAlert } from "@/components/ui";

type ElectionSummary = {
  id: string;
  name: string;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  positionCount: number;
};

export default function VotePage() {
  const [elections, setElections] = useState<ElectionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/elections")
      .then((res) => res.json())
      .then(setElections)
      .catch(() => setError("Couldn't load elections."));
  }, []);

  const open = elections?.filter((e) => e.status === "OPEN") ?? [];
  const upcoming = elections?.filter((e) => e.status === "SCHEDULED") ?? [];
  const past = elections?.filter((e) => e.status === "CLOSED" || e.status === "RESULTS_PUBLISHED") ?? [];

  return (
    <>
      <PageHeader title="Elections" description="Vote in elections you're eligible for." />
      <ErrorAlert message={error} />

      {elections === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : open.length === 0 && upcoming.length === 0 ? (
        <EmptyState icon={<VoteIcon size={40} />} title="No elections right now" description="Check back once an election is scheduled." />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Open now
              </h2>
              <div className="space-y-3">
                {open.map((e) => (
                  <ElectionRow key={e.id} election={e} />
                ))}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((e) => (
                  <ElectionRow key={e.id} election={e} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Past
              </h2>
              <div className="space-y-3">
                {past.map((e) => (
                  <ElectionRow key={e.id} election={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function ElectionRow({ election }: { election: ElectionSummary }) {
  const votable = election.status === "OPEN";
  const content = (
    <Card className={`flex items-center justify-between ${votable ? "hover:border-slate-400 dark:hover:border-slate-600" : ""}`}>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-50">{election.name}</span>
          <ElectionStatusBadge status={election.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {election.positionCount} position{election.positionCount === 1 ? "" : "s"}
        </p>
      </div>
      {votable ? (
        <ChevronRight size={20} className="text-slate-400" />
      ) : (
        election.status !== "SCHEDULED" && <CheckCircle2 size={20} className="text-slate-300 dark:text-slate-600" />
      )}
    </Card>
  );

  return votable ? (
    <Link href={`/vote/${election.id}`} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
