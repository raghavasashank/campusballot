import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { addPosition } from "@/lib/domain/positions";
import { domainErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const { title } = (await request.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "Position title is required." }, { status: 400 });

  try {
    const position = await addPosition(auth.userId, id, title.trim());
    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
