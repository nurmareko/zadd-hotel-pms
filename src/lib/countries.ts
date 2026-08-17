import { allCountries } from "country-telephone-data";

export type Country = {
  name: string;
  iso2: string;
  dialCode: string;
  priority: number;
};

export const INDONESIA_COUNTRY_CODE = "id";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const indonesia = allCountries.find(
  (country) => country.iso2 === INDONESIA_COUNTRY_CODE,
);

if (!indonesia) {
  throw new Error("Data negara Indonesia tidak ditemukan");
}

export const countries: Country[] = [
  indonesia,
  ...allCountries.filter((country) => country.iso2 !== INDONESIA_COUNTRY_CODE),
].map(({ name, iso2, dialCode, priority }) => ({
  name: regionNames.of(iso2.toUpperCase()) ?? name,
  iso2,
  dialCode,
  priority,
}));



export function findCountryByName(name: string) {
  return countries.find((country) => country.name === name) ?? null;
}

export function countryCodeToFlag(iso2: string) {
  const normalizedCode = iso2.toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return null;
  }

  return String.fromCodePoint(
    ...Array.from(normalizedCode, (character) => character.codePointAt(0)! + 127397),
  );
}
