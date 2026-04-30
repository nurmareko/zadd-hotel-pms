"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean(navigator.standalone))
  );
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

export function InstallPwaButton() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosDevice] = useState(() =>
    typeof window !== "undefined" ? isIos() : false,
  );
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const updateViewport = () => {
      setIsMobile(isMobileViewport());
      setIsInstalled(isStandalone());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setHasResponded(false);
    };

    updateViewport();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    mediaQuery.addEventListener("change", updateViewport);
    window.addEventListener("appinstalled", updateViewport);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      mediaQuery.removeEventListener("change", updateViewport);
      window.removeEventListener("appinstalled", updateViewport);
    };
  }, []);

  async function handleInstallClick() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    await installEvent.userChoice;
    setHasResponded(true);
    setInstallEvent(null);
  }

  if (!isMobile || isInstalled) {
    return null;
  }

  if (isIosDevice) {
    return (
      <div className="mx-4 mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm md:hidden">
        To install: tap the Share icon, then &apos;Add to Home Screen&apos;.
      </div>
    );
  }

  if (!installEvent || hasResponded) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-20 md:hidden">
      <Button
        type="button"
        variant="secondary"
        className="h-10 w-full border border-border bg-background text-foreground shadow-lg"
        onClick={() => void handleInstallClick()}
      >
        Install Housekeeping app
      </Button>
    </div>
  );
}
