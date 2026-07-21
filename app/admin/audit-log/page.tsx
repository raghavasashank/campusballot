"use client";

import { useEffect, useState } from "react";
import { PageHeader, EmptyState, ErrorAlert } from "@/components/ui";
import { ScrollText } from "lucide-react";

type AuditEntry = { id: string; action: string; target: string | null; actorEmail: string; createdAt: string };

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then(setEntries)
      .catch(() => setError("Couldn't load the audit log."));
  }, []);

  return (
    <>
      <PageHeader title="Audit Log" description="Every state-changing admin action, in order. This log is append-only." />
      <ErrorAlert message={error} />

      {entries === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={<ScrollText size={40} />} title="No actions logged yet" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-300">{e.actorEmail}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-slate-50">
                    {e.action}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-slate-400" title={e.target ?? ""}>
                    {e.target ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
