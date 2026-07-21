import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { sendMagicLinkEmail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { isEligibleEmail } from "@/lib/auth";

// Same response either way: don't leak whether an email is allowed/known.
const GENERIC_OK = () => NextResponse.json({ ok: true });

// Keeps someone from email-bombing a student's inbox with sign-in links —
// the realistic risk here, not token brute force (32 random bytes).
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const normalized = email?.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const limit = rateLimit(`request-link:${normalized}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminEmail = adminEmails.includes(normalized);

  if (!isEligibleEmail(normalized, process.env.ALLOWED_EMAIL_DOMAIN!, adminEmails)) {
    // Don't create a token or reveal the domain check failed — same response as success.
    return GENERIC_OK();
  }

  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized, role: isAdminEmail ? "ADMIN" : "VOTER" },
  });

  const { raw, hash, expiresAt } = generateToken();
  await prisma.loginToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  const link = `${request.nextUrl.origin}/api/auth/verify?token=${raw}`;
  await sendMagicLinkEmail(normalized, link);

  return GENERIC_OK();
}
