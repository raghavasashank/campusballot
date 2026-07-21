"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Vote } from "lucide-react";
import { PageHeader, Card, Button, Input, Label, ElectionStatusBadge, EmptyState, ErrorAlert } from "@/components/ui";

type ElectionSummary = {
  id: string;
  name: string;
  status: string;
  positionCount: number;
};

export default function AdminElectionsPage() {
  const [elections, setElections] = useState<ElectionSummary[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => fetch("/api/elections").then((res) => res.json()).then(setElections);

  useEffect(() => {
    load().catch(() => setError("Couldn't load elections."));
  }, []);

  async function createElection(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't create election.");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create election.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Elections" description="Create and manage elections." />
      <ErrorAlert message={error} />

      <Card className="mb-6 max-w-lg">
        <form onSubmit={createElection} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="name">New election name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring 2027 Student Senate" />
          </div>
          <Button type="submit" disabled={creating}>
            <Plus size={16} />
            Create
          </Button>
        </form>
      </Card>

      {elections === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : elections.length === 0 ? (
        <EmptyState icon={<Vote size={40} />} title="No elections yet" description="Create your first election above." />
      ) : (
        <div className="space-y-3">
          {elections.map((e) => (
            <Link key={e.id} href={`/admin/elections/${e.id}`} className="block">
              <Card className="flex items-center justify-between hover:border-slate-400 dark:hover:border-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-50">{e.name}</span>
                  <ElectionStatusBadge status={e.status} />
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {e.positionCount} position{e.positionCount === 1 ? "" : "s"}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
