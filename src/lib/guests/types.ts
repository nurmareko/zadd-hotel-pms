import type { GuestIdType } from "@prisma/client";

export type GuestLookupResult = {
  id: number;
  fullName: string;
  idType: GuestIdType | null;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationality: string | null;
  /** Number of linked reservations, including future and terminal reservations. */
  totalStays: number;
  /** Latest reservation arrival date, YYYY-MM-DD; not an actual check-in timestamp. */
  lastStayDate: string | null;
};

export type GuestDirectoryRow = GuestLookupResult & {
  lastRoomNumber: string | null;
};
