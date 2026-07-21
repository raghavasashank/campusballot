import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { importEligibleVotersFromCsv, previewRosterImport } from "@/lib/domain/eligibility";
import { domainErrorResponse } from "@/lib/api-errors";

// Two-step by design: without `confirm: true` this is a dry run (no writes,
// no audit log) so an admin sees exactly how many new accounts an import
// would create before committing — see the security review's "no silent
// account creation" finding. Confirming requires echoing back the
// `csvHash` the preview returned, so a commit can never write content the
// admin didn't actually see previewed (a stale tab, a re-exported roster
// mid-review) — see importEligibleVotersFromCsv.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const { csv, confirm, csvHash } = (await request.json().catch(() => ({}))) as {
    csv?: string;
    confirm?: boolean;
    csvHash?: string;
  };
  if (!csv?.trim()) return NextResponse.json({ error: "Provide a CSV file." }, { status: 400 });
  if (confirm && !csvHash) {
    return NextResponse.json({ error: "Missing csvHash — preview the import again before confirming." }, { status: 400 });
  }

  try {
    const result = confirm
      ? await importEligibleVotersFromCsv(auth.userId, id, csv, csvHash!)
      : await previewRosterImport(id, csv);
    return NextResponse.json({ ...result, committed: Boolean(confirm) });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
