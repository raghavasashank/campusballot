"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { PageHeader, Card, Button, Label, Input, Textarea, ErrorAlert, SuccessAlert } from "@/components/ui";

type OpenPosition = { id: string; title: string; electionName: string };

export default function ApplyPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<OpenPosition[] | null>(null);
  const [positionId, setPositionId] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/positions/open")
      .then((res) => res.json())
      .then((data: OpenPosition[]) => {
        setPositions(data);
        if (data[0]) setPositionId(data[0].id);
      })
      .catch(() => setError("Couldn't load open positions."));
  }, []);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, name, bio, photoUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Application failed.");
      setSuccess("Application submitted. Track its status on the My Applications page.");
      setTimeout(() => router.push("/candidate/status"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Apply as a Candidate" description="Submit your candidacy for review by election administrators." />
      <ErrorAlert message={error} />
      <SuccessAlert message={success} />

      {positions !== null && positions.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No positions are currently accepting applications.
          </p>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="position">Position</Label>
              <select
                id="position"
                required
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {positions === null && <option>Loading…</option>}
                {positions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.electionName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="name">Candidate name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="bio">Manifesto</Label>
              <Textarea
                id="bio"
                rows={6}
                placeholder="What will you do if elected?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="photo">Photo (optional)</Label>
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Preview" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <UserRound size={24} />
                  </div>
                )}
                <input id="photo" type="file" accept="image/*" onChange={handlePhoto} className="text-sm" />
              </div>
            </div>

            <Button type="submit" disabled={submitting || !positionId} className="w-full sm:w-auto">
              {submitting ? "Submitting…" : "Submit Application"}
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
