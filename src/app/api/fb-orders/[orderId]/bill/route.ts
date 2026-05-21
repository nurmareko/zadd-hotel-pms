import { FBOrderStatus } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { computeFBOrderTotals } from "@/lib/fb-order-totals";
import { FBBill } from "@/lib/pdf/fb-bill";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
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

  const totals = computeFBOrderTotals(order.items, settings);
  const billDocument = FBBill({ order, settings, totals });
  const buffer = await renderToBuffer(billDocument);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fb-bill-${order.orderNo}.pdf"`,
    },
  });
}
