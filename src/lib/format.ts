export const formatIDR = (amount: number | string) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(Number(amount))}`;
