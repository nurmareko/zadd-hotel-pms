import type { Prisma } from "@prisma/client";

export function normalizeGuestQuery(value: unknown): string {
  const query = Array.isArray(value) ? value[0] : value;
  return typeof query === "string" ? query.trim() : "";
}

export function buildGuestWhere(q: string): Prisma.GuestWhereInput {
  const query = normalizeGuestQuery(q);
  if (!query) return {};

  // Prisma contains uses LIKE: operator input should not become SQL wildcards.
  const contains = query.replace(/[\\%_]/g, "\\$&");
  return {
    OR: ["fullName", "phone", "idNumber", "email"].map((field) => ({
      [field]: { contains, mode: "insensitive" },
    })),
  };
}
