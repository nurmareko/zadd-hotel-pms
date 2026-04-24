import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getRoleHome } from "@/lib/role-routes";

export default async function AppIndexPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getRoleHome(session.user.role));
}
