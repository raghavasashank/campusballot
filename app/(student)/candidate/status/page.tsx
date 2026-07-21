"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { PageHeader, Card, CandidateStatusBadge, EmptyState, ErrorAlert } from "@/components/ui";

type Application = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  status: string;
  appliedAt: string;
  reviewedAt: string | null;
  positionTitle: string;
  electionName: string;
};

export default function CandidateStatusPage() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/candidates/me")
      .then((res) => res.json())
      .then(setApplications)
      .catch(() => setError("Couldn't load your applications."));
  }, []);

  return (
    <>
      <PageHeader title="My Applications" description="Track the status of your candidate applications." />
      <ErrorAlert message={error} />

      {applications === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : applications.length === 0 ? (
        <EmptyState title="No applications yet" description="Apply as a candidate to see your status here." />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="flex items-start gap-4">
              {app.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={app.photoUrl} alt={app.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <UserRound size={20} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-50">{app.positionTitle}</span>
                  <span className="text-sm text-slate-400">· {app.electionName}</span>
                  <CandidateStatusBadge status={app.status} />
                </div>
                {app.bio && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{app.bio}</p>}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Applied {new Date(app.appliedAt).toLocaleDateString()}
                  {app.reviewedAt && ` · Reviewed ${new Date(app.reviewedAt).toLocaleDateString()}`}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
