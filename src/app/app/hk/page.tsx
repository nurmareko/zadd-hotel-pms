import { redirect } from "next/navigation";

import { auth } from "@/auth";


export default async function HKLandingPage() {
  const session = await auth();

  if (session?.user && ["HK", "ADMIN"].includes(session.user.role)) {
    redirect("/app/hk/rooms");
  }

  redirect("/app/forbidden");
}
