import { requireApiUser } from "@/lib/auth";
import { getTurnout } from "@/lib/domain/turnout";
import { toCsv, csvResponse } from "@/lib/csv-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const turnout = await getTurnout(id);
  const csv = toCsv(turnout, [
    { key: "title", header: "Position" },
    { key: "eligible", header: "Eligible" },
    { key: "voted", header: "Voted" },
    { key: "pendingBallots", header: "Pending Batch" },
    { key: "batchedBallots", header: "Batched Ballots" },
  ]);

  return csvResponse(csv, `turnout-${id}.csv`);
}
