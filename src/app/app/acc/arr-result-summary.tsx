import { formatCompactDateID, formatIDR } from "@/lib/format";

import type { ArrDisplayData } from "./arr-display";

export function ArrResultSummary({ result }: { result: ArrDisplayData }) {
  if (result.status === "AUTHORITATIVE" && result.arr !== null) {
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
        <span className="font-semibold">ARR {formatIDR(result.arr)}</span>
        {" · "}
        <span className="num">{result.paidRoomNights}</span> recognized paid room night
        {result.paidRoomNights === 1 ? "" : "s"}
      </div>
    );
  }

  const cutover = formatCompactDateID(
    new Date(`${result.cutoverDate}T00:00:00.000Z`),
  );
  const message =
    result.status === "UNAVAILABLE"
      ? `ARR tidak tersedia — sebelum cutover ${cutover}`
      : result.status === "NO_RECOGNIZED_NIGHTS"
        ? "ARR N/A — tidak ada recognized paid room night"
        : "ARR tidak tersedia — integrity error";

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
      {message}
      {result.status === "INTEGRITY_ERROR" && result.reason ? (
        <div className="mt-1 text-xs font-normal">{result.reason}</div>
      ) : null}
    </div>
  );
}
