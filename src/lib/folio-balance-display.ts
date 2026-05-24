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
    return `Saldo Terutang: ${formatIDR(balance)}`;
  }

  if (state === "credit") {
    return `Kelebihan Pembayaran: ${absoluteBalanceLabel(balance)}`;
  }

  return "Saldo Lunas";
}

export function refundDueNote(balance: number) {
  return `Kembalikan kelebihan ${absoluteBalanceLabel(balance)} kepada tamu.`;
}

export function billBalanceLabel(balance: number) {
  const state = folioBalanceState(balance);

  if (state === "credit") {
    return "Kelebihan Pembayaran / Refund";
  }

  if (state === "settled") {
    return "Saldo Lunas";
  }

  return "Saldo Terutang";
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
