"use client";

import { useState } from "react";
import { ShieldCheck, Vote } from "lucide-react";
import { Card, Button, Label, Input, ErrorAlert } from "@/components/ui";

const REQUEST_TIMEOUT_MS = 20_000;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't send the sign-in link. Try again.");
      setStatus("sent");
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      setError(timedOut ? "That took too long. Please try again." : "Couldn't send the sign-in link. Try again.");
      setStatus("idle");
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
        <Vote size={24} />
        <span className="text-lg font-semibold">CampusBallot</span>
      </div>

      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-50">Sign in</h1>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          Use your institutional email — we&apos;ll send a one-time sign-in link, no password needed.
        </p>

        {status === "sent" ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              If <strong>{email}</strong> is an eligible institutional email, a sign-in link is on its way. Check
              your inbox.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <ErrorAlert message={error} />
            <div>
              <Label htmlFor="email">Institutional email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
              />
            </div>
            <Button type="submit" disabled={status === "sending"} className="w-full">
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
