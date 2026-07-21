type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

const ELECTION_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  OPEN: "success",
  CLOSED: "warning",
  RESULTS_PUBLISHED: "info",
};

export function ElectionStatusBadge({ status }: { status: string }) {
  return <Badge tone={ELECTION_STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>;
}

const CANDIDATE_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function CandidateStatusBadge({ status }: { status: string }) {
  return <Badge tone={CANDIDATE_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}
