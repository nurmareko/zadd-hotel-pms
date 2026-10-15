import { formatIDR } from "@/lib/format";

export type FolioBalanceState = "due" | "settled" | "credit";

export function roundedFolioBalance(balance: number) {
  return Math.round(balance);
}

export function folioBalanceState(balance: number): FolioBalanceState {
  const roundedBalance = roundedFolioBalance(balance);

  if (roundedBalance > 0) {
    return "due";
  }

  if (roundedBalance < 0) {
    return "credit";
  }

  return "settled";
}

export function absoluteBalanceLabel(balance: number) {
  return formatIDR(Math.abs(roundedFolioBalance(balance)));
}

export function checkoutBalanceHeading(balance: number) {
  const state = folioBalanceState(balance);

  if (state === "due") {
    return `Balance Due: ${formatIDR(balance)}`;
  }

  if (state === "credit") {
    return `Overpayment: ${absoluteBalanceLabel(balance)}`;
  }

  return "Balance Settled";
}

export function refundDueNote(balance: number) {
  return `Refund the overpayment of ${absoluteBalanceLabel(balance)} to the guest.`;
}

export function billBalanceLabel(balance: number) {
  const state = folioBalanceState(balance);

  if (state === "credit") {
    return "Overpayment / Refund";
  }

  if (state === "settled") {
    return "Balance Settled";
  }

  return "Balance Due";
}

export function billBalanceAmountLabel(balance: number) {
  const state = folioBalanceState(balance);

  if (state === "credit") {
    return absoluteBalanceLabel(balance);
  }

  if (state === "settled") {
    return formatIDR(0);
  }

  return formatIDR(balance);
}
