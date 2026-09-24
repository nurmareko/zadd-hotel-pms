import { auth } from "@/auth";
import type { AppRole } from "@/auth.config";
import { can } from "@/lib/permissions";
import {
  createAccountingExportCsv,
  getAccountingExportRange,
  getAccountingExportRows,
} from "../../../../../lib/accounting-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !can(session.user.role as AppRole, "accounting:export")) {
    return new Response("Forbidden", { status: session?.user ? 403 : 401 });
  }

  const params = new URL(request.url).searchParams;
  try {
    const range = getAccountingExportRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
    const rows = await getAccountingExportRows(range);
    return createAccountingExportCsv(rows, `zadd-accounting-export-${range.from}-to-${range.to}.csv`);
  } catch (error) {
    console.error("Failed to generate accounting export CSV", error);
    return new Response("Export CSV gagal. Silakan coba lagi.", { status: 500 });
  }
}