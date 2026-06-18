"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

type ClickableReservationRowProps = {
  children: ReactNode;
  href: string;
};

export function ClickableReservationRow({
  children,
  href,
}: ClickableReservationRowProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (event.target instanceof Element && event.target.closest("a"))
    ) {
      return;
    }

    router.push(href);
  }

  return (
    <tr
      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors"
      onClick={handleClick}
    >
      {children}
    </tr>
  );
}
