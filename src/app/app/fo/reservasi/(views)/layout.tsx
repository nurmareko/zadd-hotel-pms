import type { ReactNode } from "react";

import { ReservationsViewHeader } from "./reservations-view-header";

// Shared layout for the kalender/list views: the header (title, view toggle,
// new-reservation button) persists across view switches so only the content
// below re-renders when navigating between the two.
export default function ReservationViewsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen min-w-0 bg-slate-50 p-4 text-slate-900 md:p-5 lg:p-6">
      <ReservationsViewHeader />
      {children}
    </main>
  );
}
