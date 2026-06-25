import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isHkSupervisor } from "@/auth.config";

export default async function HKLandingPage() {
  const session = await auth();

  if (isHkSupervisor(session)) {
    redirect("/app/hk/supervisor");
  }

  if (session?.user.role === "HK") {
    redirect("/app/hk/clean");
  }

  redirect("/app/forbidden");
}
