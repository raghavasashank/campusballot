"use client";

import { use, useEffect, useState } from "react";
import { Download, Trophy } from "lucide-react";
import { PageHeader, Card, ErrorAlert } from "@/components/ui";

type Tally = { candidateId: string; name: string; votes: number };
type PositionResult = { positionId: string; positionTitle: string; tally: Tally[] };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [results, setResults] = useState<PositionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/elections/${id}/results`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't load results.");
        setResults(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load results."));
  }, [id]);

  return (
    <>
      <PageHeader
        title="Results"
        description="Final tallies per position."
        actions={
          <a
            href={`/api/admin/elections/${id}/results/export`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={14} />
            Download CSV
          </a>
        }
      />
      <ErrorAlert message={error} />

      {!error && !results && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {results && (
        <div className="space-y-4">
          {results.map((position) => {
            const sorted = [...position.tally].sort((a, b) => b.votes - a.votes);
            const total = sorted.reduce((sum, t) => sum + t.votes, 0);
            const leaderVotes = sorted[0]?.votes ?? 0;

            return (
              <Card key={position.positionId}>
                <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-50">{position.positionTitle}</h2>
                <div className="space-y-2">
                  {sorted.map((t) => (
                    <div key={t.candidateId} className="flex items-center gap-3">
                      {t.votes === leaderVotes && total > 0 && (
                        <Trophy size={14} className="shrink-0 text-amber-500" />
                      )}
                      <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                        {t.name}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-slate-900 dark:bg-slate-100"
                          style={{ width: `${total > 0 ? (t.votes / total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-slate-500 dark:text-slate-400">
                        {t.votes}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
