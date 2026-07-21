import { NextResponse } from "next/server";
import { DomainError, NotFoundError } from "@/lib/domain/errors";

// Every domain error carries a message safe to show a user directly (they're
// all written as user-facing sentences already). NotFoundError -> 404,
// everything else domain-shaped -> 409 (the request conflicts with current
// state — already voted, wrong election status, etc.), anything unexpected -> 500.
export function domainErrorResponse(err: unknown) {
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: 409 });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
