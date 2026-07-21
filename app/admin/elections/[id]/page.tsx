"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, RefreshCw, Upload, Users } from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Input,
  Label,
  Textarea,
  ElectionStatusBadge,
  ErrorAlert,
  SuccessAlert,
} from "@/components/ui";

type CsvImportResult = {
  csvHash: string;
  added: number;
  newAccounts: number;
  alreadyEligible: string[];
  offDomain: string[];
  duplicates: string[];
  errors: { line: number; raw: string; reason: string }[];
  committed: boolean;
};

type Position = { id: string; title: string; candidates: { id: string; name: string }[] };
type ElectionDetail = {
  id: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "RESULTS_PUBLISHED";
  opensAt: string | null;
  closesAt: string | null;
  positions: Position[];
};
type Turnout = { positionId: string; title: string; eligible: number; voted: number; pendingBallots: number; batchedBallots: number };

export default function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [turnout, setTurnout] = useState<Turnout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/elections/${id}`).then((res) => res.json()).then(setElection);
    fetch(`/api/admin/elections/${id}/turnout`).then((res) => res.json()).then(setTurnout);
  };

  useEffect(load, [id]);

  async function action(path: string, body?: object) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/elections/${id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error ?? "Action failed.");
      setSuccess("Done.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function previewCsv(csv: string) {
    setBusy(true);
    setError(null);
    setCsvResult(null);
    try {
      const res = await fetch(`/api/admin/elections/${id}/eligibility/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Preview failed.");
      setCsvResult(body);
      setPendingCsv(csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCsvImport() {
    if (!pendingCsv || !csvResult) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/elections/${id}/eligibility/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: pendingCsv, confirm: true, csvHash: csvResult.csvHash }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      setCsvResult(body);
      setPendingCsv(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!election) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;

  return (
    <>
      <PageHeader
        title={election.name}
        description="Manage lifecycle, positions, eligibility, and turnout."
        actions={<ElectionStatusBadge status={election.status} />}
      />
      <ErrorAlert message={error} />
      <SuccessAlert message={success} />

      <div className="space-y-6">
        <LifecycleCard election={election} busy={busy} onAction={action} />

        <Card>
          <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-50">Positions</h2>
          {election.positions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No positions yet.</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {election.positions.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                  <span className="text-slate-900 dark:text-slate-50">{p.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">{p.candidates.length} approved candidate(s)</span>
                </li>
              ))}
            </ul>
          )}
          <AddPositionForm busy={busy} onSubmit={(title) => action("positions", { title })} />
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
            <Users size={16} /> Eligibility
          </h2>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Paste institutional emails (one per line, or comma-separated), or upload a roster CSV with an
            &quot;email&quot; column.
          </p>
          <EligibilityForm busy={busy} onSubmit={(emails) => action("eligibility", { emails })} />

          <div className="my-4 border-t border-slate-200 dark:border-slate-800" />

          <CsvUploadForm busy={busy} onSubmit={previewCsv} />
          {csvResult && (
            <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium text-slate-900 dark:text-slate-50">
                {csvResult.committed
                  ? `${csvResult.added} student${csvResult.added === 1 ? "" : "s"} added.`
                  : `Preview: ${csvResult.added} student${csvResult.added === 1 ? "" : "s"} would be added, ${
                      csvResult.newAccounts
                    } brand-new account${csvResult.newAccounts === 1 ? "" : "s"}.`}
              </p>
              {csvResult.alreadyEligible.length > 0 && (
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {csvResult.alreadyEligible.length} already eligible: {csvResult.alreadyEligible.join(", ")}
                </p>
              )}
              {csvResult.offDomain.length > 0 && (
                <p className="mt-1 text-red-700 dark:text-red-400">
                  {csvResult.offDomain.length} rejected — outside your institution&apos;s email domain:{" "}
                  {csvResult.offDomain.join(", ")}
                </p>
              )}
              {csvResult.duplicates.length > 0 && (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  {csvResult.duplicates.length} duplicate row{csvResult.duplicates.length === 1 ? "" : "s"} skipped:{" "}
                  {csvResult.duplicates.join(", ")}
                </p>
              )}
              {csvResult.errors.length > 0 && (
                <div className="mt-1 text-red-700 dark:text-red-400">
                  <p>{csvResult.errors.length} row(s) couldn&apos;t be read:</p>
                  <ul className="ml-4 list-disc">
                    {csvResult.errors.map((e, i) => (
                      <li key={i}>
                        {e.line > 0 ? `Line ${e.line}: ` : ""}
                        {e.reason}
                        {e.raw && ` ("${e.raw}")`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!csvResult.committed && csvResult.added > 0 && (
                <Button size="sm" className="mt-3" disabled={busy} onClick={confirmCsvImport}>
                  Confirm import ({csvResult.added})
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-900 dark:text-slate-50">Turnout</h2>
            <div className="flex gap-2">
              <a
                href={`/api/admin/elections/${id}/turnout/export`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download size={14} />
                Download CSV
              </a>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => action("batch")}>
                <RefreshCw size={14} />
                Process pending ballots
              </Button>
            </div>
          </div>
          {!turnout ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : turnout.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Add positions to see turnout.</p>
          ) : (
            <div className="space-y-3">
              {turnout.map((t) => {
                const pct = t.eligible > 0 ? Math.round((t.voted / t.eligible) * 100) : 0;
                return (
                  <div key={t.positionId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-50">{t.title}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t.voted} / {t.eligible} voted ({pct}%)
                        {t.pendingBallots > 0 && ` · ${t.pendingBallots} pending batch`}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-slate-900 dark:bg-slate-100" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {(election.status === "CLOSED" || election.status === "RESULTS_PUBLISHED") && (
          <Card>
            <Link href={`/admin/elections/${id}/results`} className="text-sm font-medium text-slate-900 underline dark:text-slate-50">
              View results →
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}

function LifecycleCard({
  election,
  busy,
  onAction,
}: {
  election: ElectionDetail;
  busy: boolean;
  onAction: (path: string, body?: object) => void;
}) {
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");

  return (
    <Card>
      <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-50">Lifecycle</h2>
      {election.status === "DRAFT" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAction("schedule", { opensAt, closesAt });
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div>
            <Label htmlFor="opensAt">Opens at</Label>
            <Input id="opensAt" type="datetime-local" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="closesAt">Closes at</Label>
            <Input id="closesAt" type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>
            Schedule
          </Button>
        </form>
      )}
      {election.status === "SCHEDULED" && (
        <Button disabled={busy} onClick={() => onAction("open")}>
          Open Voting
        </Button>
      )}
      {election.status === "OPEN" && (
        <Button variant="danger" disabled={busy} onClick={() => onAction("close")}>
          Close Voting
        </Button>
      )}
      {election.status === "CLOSED" && (
        <Button disabled={busy} onClick={() => onAction("publish")}>
          Publish Results
        </Button>
      )}
      {election.status === "RESULTS_PUBLISHED" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Results are published. No further transitions.</p>
      )}
    </Card>
  );
}

function AddPositionForm({ busy, onSubmit }: { busy: boolean; onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(title);
        setTitle("");
      }}
      className="flex items-end gap-2"
    >
      <div className="flex-1">
        <Label htmlFor="positionTitle">Add a position</Label>
        <Input id="positionTitle" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Treasurer" />
      </div>
      <Button type="submit" disabled={busy}>
        <Plus size={16} />
        Add
      </Button>
    </form>
  );
}

function CsvUploadForm({ busy, onSubmit }: { busy: boolean; onSubmit: (csv: string) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setContent(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (content) onSubmit(content);
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <label className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        <Upload size={16} />
        {fileName ?? "Choose roster CSV…"}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </label>
      <Button type="submit" variant="secondary" disabled={busy || !content}>
        Preview Import
      </Button>
    </form>
  );
}

function EligibilityForm({ busy, onSubmit }: { busy: boolean; onSubmit: (emails: string) => void }) {
  const [emails, setEmails] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(emails);
        setEmails("");
      }}
      className="space-y-2"
    >
      <Textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"jane@college.edu\njohn@college.edu"} />
      <Button type="submit" disabled={busy}>
        Add Eligible Voters
      </Button>
    </form>
  );
}
