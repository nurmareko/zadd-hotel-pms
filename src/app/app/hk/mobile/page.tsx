import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { todayDateOnly } from "@/lib/date-only";
import { getHousekeeperMobileData } from "@/lib/housekeeper-mobile-data";

import { MobileView } from "./mobile-view";

export const dynamic = "force-dynamic";

export default async function HousekeepingMobilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["HK", "ADMIN"].includes(session.user.role)) notFound();

  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) notFound();

  const data = await getHousekeeperMobileData(userId, todayDateOnly().today);
  return (
    <MobileView
      data={data}
      userId={userId}
      userName={session.user.fullName}
      userRole={session.user.role}
    />
  );
}
