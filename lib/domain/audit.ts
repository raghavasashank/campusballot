import type { Prisma } from "@/app/generated/prisma/client";

// Shared by every admin-facing domain action — see ARCHITECTURE.md audit_log
// and SCOPE.md (this is the accountability mechanism for the merged admin role).
export async function logAction(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  target?: string,
) {
  await tx.auditLog.create({ data: { actorId, action, target } });
}
