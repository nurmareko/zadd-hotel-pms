import { FBOrderStatus } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { FBBill } from "@/lib/pdf/fb-bill";
import { prisma } from "@/lib/prisma";

function validMoneyParam(value: string | null) {
  if (!value) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return value;
}

function cashDetailsFromReference(reference: string | null | undefined) {
  if (!reference?.startsWith("CASH_TENDERED=")) {
    return null;
  }

  const parts = Object.fromEntries(
    reference.split(";").map((part) => {
      const [key, value] = part.split("=");

      return [key, value];
    }),
  );

  if (!parts.CASH_TENDERED || !parts.CHANGE) {
    return null;
  }

  return {
    amountTendered: parts.CASH_TENDERED,
    change: parts.CHANGE,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "FB") {
    return new Response("Forbidden", { status: 403 });
  }

  const { orderId } = await params;
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid order id", { status: 400 });
  }

  const [order, settings] = await Promise.all([
    prisma.fBOrder.findUnique({
      where: { id },
      include: {
        table: { select: { number: true } },
        waitedBy: { select: { fullName: true } },
        chargedFolio: { select: { folioNo: true } },
        payments: {
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: { method: true, reference: true },
        },
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.hotelSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  if (order.status === FBOrderStatus.VOIDED) {
    return new Response("Voided orders cannot be printed", { status: 409 });
  }

  if (!settings) {
    return new Response("Hotel settings not found", { status: 500 });
  }

  const url = new URL(req.url);
  const latestPayment = order.payments[0] ?? null;
  const cashDetails = cashDetailsFromReference(latestPayment?.reference);
  const totals = computeFBOrderTotals(order.items, settings);
  const receiptDocument = FBBill({
    order,
    settings,
    totals,
    receipt: {
      paymentMethod: order.paymentMethod ?? latestPayment?.method ?? null,
      reference: latestPayment?.reference?.startsWith("CASH_TENDERED=")
        ? null
        : latestPayment?.reference ?? null,
      folioNo: order.chargedFolio?.folioNo ?? null,
      amountTendered:
        validMoneyParam(url.searchParams.get("tendered")) ??
        cashDetails?.amountTendered ??
        null,
      change:
        validMoneyParam(url.searchParams.get("change")) ??
        cashDetails?.change ??
        null,
    },
  });
  const buffer = await renderToBuffer(receiptDocument);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fb-receipt-${order.orderNo}.pdf"`,
    },
  });
}
