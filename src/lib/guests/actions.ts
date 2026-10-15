"use server";

import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import { normalizeGuestQuery } from "./filters";
import { findGuests } from "./queries";
import type { GuestLookupResult } from "./types";

export async function searchGuestsAction(q: string): Promise<GuestLookupResult[]> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "reservations:read")) {
    throw new Error("You do not have access to search guests.");
  }
  if (typeof q !== "string") {
    throw new Error("Invalid guest search term.");
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
