"use client";

import { useState, type ComponentProps } from "react";

import { CountryCombobox } from "@/components/country-combobox";
import { Input } from "@/components/ui/input";
import {
  countries,
  normalizePhoneNumber,
  parsePhoneNumber,
  type Country,
} from "@/lib/countries";

type CountryPhoneInputProps = {
  initialValue: string;
  onChangeAction: (value: string) => void;
  onBlurAction: () => void;
  name: string;
  invalid?: boolean;
} & Pick<ComponentProps<"input">, "id" | "aria-describedby">;

export function CountryPhoneInput({
  initialValue,
  onChangeAction,
  onBlurAction,
  name,
  invalid = false,
  id,
  "aria-describedby": ariaDescribedBy,
}: CountryPhoneInputProps) {
  const [initialPhone] = useState(() => parsePhoneNumber(initialValue));
  const [country, setCountry] = useState<Country>(initialPhone.country);
  const [subscriberNumber, setSubscriberNumber] = useState(
    initialPhone.subscriberNumber,
  );

  function updatePhone(nextCountry: Country, nextSubscriberNumber: string) {
    onChangeAction(normalizePhoneNumber(nextCountry.dialCode, nextSubscriberNumber));
  }

  return (
    <div className="flex min-w-0">
      <CountryCombobox
        ariaLabel="Kode negara telepon"
        countries={countries}
        value={country}
        mode="dial-code"
        invalid={invalid}
        onValueChangeAction={(nextCountry) => {
          setCountry(nextCountry);
          updatePhone(nextCountry, subscriberNumber);
        }}
      />
      <Input
        id={id}
        name={name}
        value={subscriberNumber}
        onChange={(event) => {
          const nextSubscriberNumber = event.target.value;
          setSubscriberNumber(nextSubscriberNumber);
          updatePhone(country, nextSubscriberNumber);
        }}
        onBlur={onBlurAction}
        aria-label="Nomor telepon tanpa kode negara"
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className="h-11 min-w-0 rounded-l-none border-slate-300 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500 desktop:h-10"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="812 3456 7890"
      />
    </div>
  );
}
