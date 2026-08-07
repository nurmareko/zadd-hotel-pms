"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, type ComponentProps } from "react";

import type { Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

type CountryComboboxProps = {
  countries: Country[];
  value: Country;
  onValueChangeAction: (country: Country) => void;
  mode: "country" | "dial-code";
  ariaLabel: string;
  invalid?: boolean;
} & Pick<ComponentProps<"button">, "id" | "aria-describedby">;



export function CountryCombobox({
  countries,
  value,
  onValueChangeAction,
  mode,
  ariaLabel,
  invalid = false,
  id,
  "aria-describedby": ariaDescribedBy,
}: CountryComboboxProps) {
  const filter = useMemo(
    () => (country: Country, query: string) => {
      const normalizedQuery = query.trim().toLocaleLowerCase();

      if (!normalizedQuery) {
        return true;
      }

      return (
        country.name.toLocaleLowerCase().includes(normalizedQuery) ||
        country.iso2.toLocaleLowerCase().includes(normalizedQuery) ||
        (mode === "dial-code" &&
          `+${country.dialCode}`.includes(normalizedQuery.replace(/\s/g, "")))
      );
    },
    [mode],
  );

  return (
    <Combobox.Root
      items={countries}
      value={value}
      onValueChange={(country) => {
        if (country) {
          onValueChangeAction(country);
        }
      }}
      itemToStringLabel={(country: Country) => country.name}
      isItemEqualToValue={(country, selected) => country.iso2 === selected.iso2}
      filter={filter}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none transition-colors hover:bg-slate-50 focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500 aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500 desktop:h-10",
          mode === "dial-code" && "w-28 shrink-0 rounded-r-none border-r-0 px-2.5",
        )}
      >
        <Combobox.Value>
          {(country: Country | null) =>
            country ? (
              mode === "country" ? (
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
              ) : (
                <span className="num">+{country.dialCode}</span>
              )
            ) : null
          }
        </Combobox.Value>
        <ChevronsUpDown
          className="size-4 shrink-0 text-slate-500"
          aria-hidden="true"
        />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          collisionPadding={16}
          className="isolate z-50"
        >
          <Combobox.Popup
            aria-label={ariaLabel}
            className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg outline-none"
          >
            <div className="flex h-11 items-center gap-2 border-b border-slate-200 px-3 desktop:h-10">
              <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <Combobox.Input
                aria-label={`Cari ${ariaLabel.toLocaleLowerCase()}`}
                placeholder={
                  mode === "country"
                    ? "Cari nama negara atau kode ISO"
                    : "Cari negara atau kode telepon"
                }
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-slate-500">
              Negara tidak ditemukan.
            </Combobox.Empty>
            <Combobox.List className="max-h-64 overflow-y-auto overscroll-contain p-1">
              {(country: Country) => (
                <Combobox.Item
                  key={country.iso2}
                  value={country}
                  className="relative flex min-h-11 cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 outline-none select-none data-highlighted:bg-slate-100 data-highlighted:text-slate-950 data-selected:font-medium desktop:min-h-10"
                >
                  <Combobox.ItemIndicator className="flex size-4 shrink-0 items-center justify-center text-emerald-600">
                    <Check className="size-4" aria-hidden="true" />
                  </Combobox.ItemIndicator>
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="num shrink-0 text-xs text-slate-500">
                    {mode === "country"
                      ? country.iso2.toUpperCase()
                      : `+${country.dialCode}`}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
