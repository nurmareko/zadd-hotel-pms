import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  FO_RESERVASI_VIEW_COOKIE,
  FO_RESERVASI_VIEW_PATHS,
  parseFoReservasiView,
} from "@/lib/nav-preferences";

export default async function FoReservasiPage() {
  const preferredView = parseFoReservasiView(
    (await cookies()).get(FO_RESERVASI_VIEW_COOKIE)?.value,
  );

  redirect(FO_RESERVASI_VIEW_PATHS[preferredView ?? "kalender"]);
}
