"use server";

import { auth } from "@/auth";
import { normalizeGuestQuery } from "./filters";
import { findGuests } from "./queries";
import type { GuestLookupResult } from "./types";

export async function searchGuestsAction(q: string): Promise<GuestLookupResult[]> {
  const session = await auth();
  if (!session?.user || !["FO", "ADMIN"].includes(session.user.role)) {
    throw new Error("Anda tidak memiliki akses untuk mencari tamu.");
  }
  if (typeof q !== "string") {
    throw new Error("Kata pencarian tamu tidak valid.");
  }

  const query = normalizeGuestQuery(q);
  if (!query) return [];

  const guests = await findGuests(query, 10);
  return guests.map((guest) => ({
    id: guest.id,
    fullName: guest.fullName,
    idType: guest.idType,
    idNumber: guest.idNumber,
    phone: guest.phone,
    email: guest.email,
    address: guest.address,
    nationality: guest.nationality,
    totalStays: guest.totalStays,
    lastStayDate: guest.lastStayDate,
  }));
}
