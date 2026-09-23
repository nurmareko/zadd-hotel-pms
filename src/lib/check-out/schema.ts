import { z } from "zod";

export { PaymentSchema as CheckoutPaymentSchema } from "@/lib/folio/schema";

export const CompleteCheckoutSchema = z.object({
  folioId: z.coerce.number().int().positive("Folio wajib dipilih"),
  confirmed: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.literal(true, {
      error: "Konfirmasi wajib dicentang sebelum check-out",
    }),
  ),
});
