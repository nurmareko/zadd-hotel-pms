"use client";

import { useEffect, useState } from "react";

function formatElapsed(elapsed: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsed / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CleaningTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function updateElapsed() {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }

    updateElapsed();
    const interval = window.setInterval(() => {
      updateElapsed();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="num font-mono text-[32px] font-bold leading-none text-console-ink">
      {formatElapsed(elapsed)}
    </span>
  );
}
