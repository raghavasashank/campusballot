import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/tokens";
import { createSession } from "@/lib/session";

// GET never touches the database or consumes the token — it only redirects
// to a confirmation page. Email clients and corporate scanners (Outlook Safe
// Links, Gmail's image/link proxy) prefetch GET links in emails, which would
// silently burn a single-use magic-link token before the real recipient
// clicks it. Consumption only happens on the explicit POST below, triggered
// by a real user clicking "Confirm sign-in".
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }
  return NextResponse.redirect(new URL(`/login/confirm?token=${encodeURIComponent(token)}`, request.url));
}

export async function POST(request: NextRequest) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const session = await consumeLoginToken(token);
  if (!session) {
    return NextResponse.json({ error: "This sign-in link is invalid or has expired." }, { status: 400 });
  }

  await createSession(session.userId);

  return NextResponse.json({ ok: true });
}
