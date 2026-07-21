import { requireApiUser } from "@/lib/auth";
import { computeResults } from "@/lib/domain/results";
import { toCsv, csvResponse } from "@/lib/csv-export";
import { domainErrorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  try {
    const results = await computeResults(id);
    const rows = results.flatMap((position) =>
      position.tally.map((t) => ({ position: position.positionTitle, candidate: t.name, votes: t.votes })),
    );
    const csv = toCsv(rows, [
      { key: "position", header: "Position" },
      { key: "candidate", header: "Candidate" },
      { key: "votes", header: "Votes" },
    ]);
    return csvResponse(csv, `results-${id}.csv`);
  } catch (err) {
    return domainErrorResponse(err);
  }
}
