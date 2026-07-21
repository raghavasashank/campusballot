import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { applyAsCandidate } from "@/lib/domain/candidates";
import { domainErrorResponse } from "@/lib/api-errors";
import { isValidImageDataUrl } from "@/lib/photo";

// Photo is accepted as a data URL (client reads the file with FileReader) —
// no blob storage wired up for v1, this keeps the demo self-contained.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiUser("VOTER");
  if ("error" in auth) return auth.error;

  const { positionId, name, bio, photoUrl } = (await request.json().catch(() => ({}))) as {
    positionId?: string;
    name?: string;
    bio?: string;
    photoUrl?: string;
  };
  if (!positionId || !name?.trim()) {
    return NextResponse.json({ error: "positionId and name are required." }, { status: 400 });
  }
  if (photoUrl) {
    if (photoUrl.length > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo is too large (2MB max)." }, { status: 400 });
    }
    if (!isValidImageDataUrl(photoUrl)) {
      return NextResponse.json({ error: "Photo must be a PNG, JPEG, GIF, or WebP image." }, { status: 400 });
    }
  }

  try {
    const candidate = await applyAsCandidate(auth.userId, positionId, name.trim(), bio?.trim(), photoUrl);
    return NextResponse.json(candidate, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
