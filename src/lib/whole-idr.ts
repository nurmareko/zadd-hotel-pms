function percentToBasisPoints(percent: string) {
  const [wholePart = "0", fractionalPart = ""] = percent.split(".");
  const hundredths = fractionalPart.padEnd(2, "0").slice(0, 2);

  return Number(wholePart) * 100 + Number(hundredths);
}

export function roundIDRPercentage(amount: number, percent: string) {
  const basisPoints = percentToBasisPoints(percent);

  return Math.round((amount * basisPoints) / 10_000);
}
