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
      className="cursor-pointer odd:bg-console-surface even:bg-console-bg hover:bg-status-vc-bg"
      onClick={handleClick}
    >
      {children}
    </tr>
  );
}
