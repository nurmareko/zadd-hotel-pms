import { z } from "zod";

export const BillOrderIdSchema = z.object({
  orderId: z.coerce.number().int().positive("Order wajib dipilih"),
});
