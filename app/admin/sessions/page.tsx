"use client";

import { useEffect, useState } from "react";
import { ShieldOff, Users } from "lucide-react";
import { PageHeader, EmptyState, ErrorAlert, SuccessAlert, Button, Badge } from "@/components/ui";

type SessionRow = {
  id: string;
  userId: string;
  email: string;
  role: "ADMIN" | "VOTER";
  createdAt: string;
  expiresAt: string;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/sessions")
      .then((res) => res.json())
      .then(setSessions)
      .catch(() => setError("Couldn't load active sessions."));
  };

  useEffect(load, []);

  async function revokeOne(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/revoke`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Revoke failed.");
      setSuccess("Session revoked.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllForUser(userId: string, email: string) {
    setBusyId(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/revoke-sessions`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Revoke failed.");
      setSuccess(`Revoked ${body.revoked} session(s) for ${email}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Active Sessions"
        description="Kill a single session, or every session for a user — takes effect immediately, on their very next request."
      />
      <ErrorAlert message={error} />
      <SuccessAlert message={success} />

      {sessions === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="No active sessions" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Signed in</th>
                <th className="px-4 py-2">Expires</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-900 dark:text-slate-50">{s.email}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge tone={s.role === "ADMIN" ? "info" : "neutral"}>{s.role}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(s.expiresAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => revokeOne(s.id)}
                      >
                        <ShieldOff size={14} />
                        Revoke session
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => revokeAllForUser(s.userId, s.email)}
                      >
                        Revoke all for user
                      </Button>
                    </div>
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
