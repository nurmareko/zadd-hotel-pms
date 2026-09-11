"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ManagerFlashActions() {
  return (
    <Button onClick={() => window.print()} type="button" variant="outline">
      <Printer aria-hidden="true" />
      Cetak
    </Button>
  );
}