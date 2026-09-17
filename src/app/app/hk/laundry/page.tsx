import { Shirt } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function LaundryPage() {
  return (
    <main className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Manajemen Binatu / Laundry
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kelola layanan binatu hotel dalam satu tempat.
        </p>
      </header>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Shirt className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Segera Hadir</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Modul manajemen binatu sedang disiapkan dan belum tersedia.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
