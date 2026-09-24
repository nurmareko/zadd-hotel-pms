import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function canAccessLostFound(user: { id?: string; role: string }): Promise<boolean> {
  const userId = Number(user.id);
  if (!can(user.role as AppRole, "lost_found:manage") || !Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    return false;
  }
  const currentUser = await prisma.user.findFirst({
    where: { id: userId, isActive: true, roles: { some: { role: { code: user.role } } } },
    select: { id: true },
  });
  return currentUser !== null;
}
