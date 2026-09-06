import { PaymentMethod } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PayOrderDirectSchema } from "./schema";

const basePayment = {
  orderId: 1,
  method: PaymentMethod.CASH,
  selectedItems: [{ orderItemId: 1, quantity: 1 }],
};

describe("PayOrderDirectSchema", () => {
  it("accepts cash received in whole IDR", () => {
    expect(
      PayOrderDirectSchema.safeParse({
        ...basePayment,
        amountTendered: 28_876,
      }).success,
    ).toBe(true);
  });

  it("rejects fractional cash received", () => {
    const result = PayOrderDirectSchema.safeParse({
      ...basePayment,
      amountTendered: 28_876.5,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Uang diterima harus dalam rupiah penuh",
    );
  });
});
