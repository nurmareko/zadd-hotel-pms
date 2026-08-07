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

export const indonesiaCountry = countries[0];

const canonicalCountryBySharedDialCode: Record<string, string> = {
  "1": "us",
  "7": "ru",
  "39": "it",
  "44": "gb",
  "47": "no",
  "61": "au",
  "64": "nz",
  "212": "ma",
  "262": "re",
  "358": "fi",
  "500": "fk",
  "590": "gp",
  "599": "cw",
  "672": "nf",
};

const countriesByDialCode = [...countries].sort((left, right) => {
  const lengthDifference = right.dialCode.length - left.dialCode.length;

  if (lengthDifference !== 0) {
    return lengthDifference;
  }

  const dialCodeDifference = left.dialCode.localeCompare(right.dialCode);

  if (dialCodeDifference !== 0) {
    return dialCodeDifference;
  }

  const priorityDifference = left.priority - right.priority;

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const canonicalIso2 = canonicalCountryBySharedDialCode[left.dialCode];

  if (left.iso2 === canonicalIso2) {
    return -1;
  }

  if (right.iso2 === canonicalIso2) {
    return 1;
  }

  return left.iso2.localeCompare(right.iso2);
});

export function findCountryByName(name: string) {
  return countries.find((country) => country.name === name) ?? null;
}

function normalizedPhoneForParsing(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  return compact.startsWith("+") ? `+${compact.replace(/^\++/, "")}` : compact;
}

export type ParsedPhoneNumber = {
  country: Country;
  subscriberNumber: string;
  matchedDialCode: boolean;
};

export function parsePhoneNumber(value: string): ParsedPhoneNumber {
  const normalized = normalizedPhoneForParsing(value);

  if (normalized.startsWith("+")) {
    const country = countriesByDialCode.find((candidate) =>
      normalized.startsWith(`+${candidate.dialCode}`),
    );

    if (country) {
      return {
        country,
        subscriberNumber: normalized.slice(country.dialCode.length + 1),
        matchedDialCode: true,
      };
    }
  }

  return {
    country: indonesiaCountry,
    subscriberNumber: value,
    matchedDialCode: false,
  };
}

export function normalizePhoneNumber(
  dialCode: string,
  subscriberNumber: string,
) {
  const normalizedSubscriber = subscriberNumber
    .replace(/[\s-]/g, "")
    .replace(/^\++/, "");

  if (!normalizedSubscriber) {
    return "";
  }

  return `+${dialCode.replace(/\D/g, "")}${normalizedSubscriber}`;
}
