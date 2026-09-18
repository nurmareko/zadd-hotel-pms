import { Prisma } from "@prisma/client";
import { generateLostFoundReferenceCode, getLostFoundCodeMonth } from "./reference-code";

export function isLostFoundReferenceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.some((field) => field === "reference_code" || field === "referenceCode")
    : typeof target === "string" && (target.includes("reference_code") || target.includes("referenceCode"));
}

/**
 * Must run inside the caller's complete transaction, after any room lock.
 * Every writer uses this lock, including the first item in a month. Serializable
 * callers must retry the WHOLE transaction on P2034 or reference-code P2002:
 * waiting for an advisory lock does not refresh a serializable snapshot.
 */
export async function allocateLostFoundReference(tx: Prisma.TransactionClient): Promise<{ referenceCode: string; createdAt: Date }> {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('lost-found-reference-code'))`;
  const createdAt = new Date();
  const { prefix, start, end } = getLostFoundCodeMonth(createdAt);
  const pattern = `^${prefix}[0-9]+$`;
  // Count historical entries, but also respect suffixes already reserved by
  // backfills (even when their logged timestamp lies outside this month).
  const [allocation] = await tx.$queryRaw<Array<{ count: string; maximum: string }>>`
    SELECT
      (SELECT count(*)::text FROM "lost_found_item" WHERE "created_at" >= ${start} AND "created_at" < ${end}) AS "count",
      (SELECT COALESCE(max(substring("reference_code" FROM ${prefix.length + 1}::integer)::numeric), 0)::text
       FROM "lost_found_item" WHERE "reference_code" ~ ${pattern}) AS "maximum"
  `;
  const count = Math.max(Number(allocation.count), Number(allocation.maximum));
  return { referenceCode: generateLostFoundReferenceCode(createdAt, count), createdAt };
}
