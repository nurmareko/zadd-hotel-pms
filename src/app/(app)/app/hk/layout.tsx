import type { ReactNode } from "react";

import { auth } from "@/auth";
import { InstallPwaButton } from "@/components/InstallPwaButton";

export default async function HKLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const showInstall = session?.user?.role === "HK";

  return (
    <>
      {showInstall && <InstallPwaButton />}
      {children}
    </>
  );
}
