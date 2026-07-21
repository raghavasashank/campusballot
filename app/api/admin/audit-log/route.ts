import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireApiUser("ADMIN");
  if ("error" in auth) return auth.error;

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true } } },
  });

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      action: e.action,
      target: e.target,
      actorEmail: e.actor.email,
      createdAt: e.createdAt,
    })),
  );
}
