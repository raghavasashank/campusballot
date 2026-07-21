"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Vote } from "lucide-react";
import { Card, Button, ErrorAlert } from "@/components/ui";

// Deliberately a click-through page rather than an auto-consuming link — see
// app/api/auth/verify/route.ts for why (email link-scanners prefetch GETs).
function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "confirming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!token) return;
    setStatus("confirming");
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "This sign-in link is invalid or has expired.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
        <Vote size={24} />
        <span className="text-lg font-semibold">CampusBallot</span>
      </div>

      <Card className="w-full max-w-sm text-center">
        <ShieldCheck size={28} className="mx-auto mb-3 text-slate-400" />
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-50">Confirm sign-in</h1>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          Click below to finish signing in to CampusBallot.
        </p>
        <ErrorAlert message={error} />
        {token ? (
          <Button className="w-full" disabled={status === "confirming"} onClick={confirm}>
            {status === "confirming" ? "Signing in…" : "Confirm sign-in"}
          </Button>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">This sign-in link is missing its token.</p>
        )}
      </Card>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}
