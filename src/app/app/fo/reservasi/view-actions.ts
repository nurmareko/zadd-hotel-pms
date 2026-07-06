"use server";

import { cookies } from "next/headers";

import {
  FO_RESERVASI_VIEW_COOKIE,
  type FoReservasiView,
  parseFoReservasiView,
} from "@/lib/nav-preferences";

export async function setFoReservasiView(view: FoReservasiView) {
  const parsedView = parseFoReservasiView(view);

  if (!parsedView) {
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set(FO_RESERVASI_VIEW_COOKIE, parsedView, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/app/fo/reservasi",
    sameSite: "lax",
  });
}
