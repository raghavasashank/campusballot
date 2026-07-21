"use client";

import { useState } from "react";
import { ShieldCheck, Vote } from "lucide-react";
import { Card, Button, Label, Input } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus("sent");
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
