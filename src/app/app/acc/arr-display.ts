import type { ArrResult } from "@/lib/arr";

export type ArrDisplayData = {
  status: ArrResult["status"];
  numerator: string;
  paidRoomNights: number;
  arr: string | null;
  fromInclusive: string;
  toExclusive: string;
  cutoverDate: string;
  reason?: string;
};

export function toArrDisplayData(result: ArrResult): ArrDisplayData {
  return {
    status: result.status,
    numerator: result.numerator.toString(),
    paidRoomNights: result.paidRoomNights,
    arr: result.arr?.toString() ?? null,
    fromInclusive: result.fromInclusive.toISOString().slice(0, 10),
    toExclusive: result.toExclusive.toISOString().slice(0, 10),
    cutoverDate: result.cutoverDate.toISOString().slice(0, 10),
    reason: result.reason,
  };
}
