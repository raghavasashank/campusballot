import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getTurnout } from "@/lib/domain/turnout";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  return NextResponse.json(await getTurnout(id));
}
