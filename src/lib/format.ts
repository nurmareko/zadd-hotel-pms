export const formatIDR = (amount: number | string) =>
  `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(amount))}`;
