import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@/app/generated/prisma/client";
import { createSessionRecord, validateSession as validateSessionRecord, revokeSessionRecord } from "@/lib/session-store";

// ponytail: hand-rolled signed cookie instead of a JWT library — HMAC over a
// JSON payload is a few lines and there's nothing here a JWT lib buys us
// (no third-party verifiers, no key rotation needs). Swap for `jose` if that changes.
//
// The cookie carries only a session id, never role/exp directly — those are
// looked up from the Session table on every request, so a revoked session
// stops working on the very next request rather than waiting for the
// (long-lived) cookie to naturally expire. See lib/session-store.ts.

const COOKIE_NAME = "campusballot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches Session.expiresAt in session-store.ts

type CookiePayload = { sid: string };

export const INSECURE_DEFAULT_SECRET = "dev-only-secret-change-me";

export function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  if (process.env.NODE_ENV === "production" && s === INSECURE_DEFAULT_SECRET) {
    throw new Error(
      "SESSION_SECRET is still set to the insecure default (\"" +
        INSECURE_DEFAULT_SECRET +
        "\") in production. Generate a real secret and set it before deploying.",
    );
  }
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload: CookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): CookiePayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as CookiePayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const { id } = await createSessionRecord(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ sid: id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<{ userId: string; role: Role; sessionId: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const cookiePayload = decode(token);
  if (!cookiePayload) return null;

  const session = await validateSessionRecord(cookiePayload.sid);
  if (!session) return null;

  return { ...session, sessionId: cookiePayload.sid };
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const cookiePayload = token ? decode(token) : null;
  if (cookiePayload) {
    // Best-effort: logging out kills the session server-side too, so a
    // copied/leaked cookie stops working immediately, not just once it
    // naturally expires.
    await revokeSessionRecord(cookiePayload.sid).catch(() => {});
  }
  store.delete(COOKIE_NAME);
}
