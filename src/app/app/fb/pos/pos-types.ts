import type { FBOrderServiceType, FBOrderStatus, TableLocation, TableStatus } from "@prisma/client";

export type PosMenuItem = {
  id: number;
  name: string;
  category: string;
  price: string;
};

export type PosTable = {
  id: number;
  number: string;
  capacity: number;
  location: TableLocation;
  status: TableStatus;
  posX: number;
  posY: number;
  notes: string | null;
  orderIds: number[];
};

export type PosOrderItem = {
  id: number;
  name: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  notes: string;
  guestNumber: number | null;
};

export type PosTotals = {
  subtotal: string;
  serviceCharge: string;
  tax: string;
  total: string;
};

export type PosSettings = {
  serviceChargePercent: string;
  taxPercent: string;
};

export type PosOrder = {
  id: number;
  orderNo: string;
  tableId: number | null;
  serviceType: FBOrderServiceType;
  status: FBOrderStatus;
  destination: string;
  guestCount: number;
  waiterName: string;
  kitchenStartedAt: string | null;
  kitchenReadyAt: string | null;
  items: PosOrderItem[];
  totals: PosTotals;
  attachedRoomFolio: {
    roomNumber: string;
    guestName: string;
    folioNo: string;
  } | null;
};
