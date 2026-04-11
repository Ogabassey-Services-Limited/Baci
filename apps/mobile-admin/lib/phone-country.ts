import { COUNTRIES } from '@/constants/countries';

type CountryMetadata = {
  callingCode?: string[];
};

const countryPhoneMetadata =
  require('react-native-country-picker-modal/lib/assets/data/countries-emoji.json') as Record<
    string,
    CountryMetadata
  >;

const DEFAULT_COUNTRY_CODE = 'NG';
// 127397 maps ASCII A-Z to the Unicode regional indicator block used for flags.
const FLAG_EMOJI_BASE = 127397;

export type PhoneCountry = (typeof COUNTRIES)[number] & {
  callingCode: string;
  flagEmoji: string;
};

function countryCodeToFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (character) =>
      String.fromCodePoint(FLAG_EMOJI_BASE + character.charCodeAt(0))
    );
}

export const PHONE_COUNTRIES: PhoneCountry[] = COUNTRIES.map((country) => ({
  ...country,
  callingCode: countryPhoneMetadata[country.code]?.callingCode?.[0] ?? '',
  flagEmoji: countryCodeToFlagEmoji(country.code),
})).filter((country): country is PhoneCountry => Boolean(country.callingCode));

const defaultPhoneCountry =
  PHONE_COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE) ??
  PHONE_COUNTRIES[0];
const LONGEST_CALLING_CODE_FIRST = [...PHONE_COUNTRIES].sort(
  (left, right) => right.callingCode.length - left.callingCode.length
);

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function getCandidateInternationalDigits(value: string): string {
  const digits = normalizeDigits(value);
  if (!digits) {
    return '';
  }

  if (value.trim().startsWith('+')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `${defaultPhoneCountry.callingCode}${digits.slice(1)}`;
  }

  return digits;
}

export function getPhoneCountryByCode(
  countryCode?: string | null
): PhoneCountry {
  const normalizedCode = countryCode?.trim().toUpperCase();
  return (
    PHONE_COUNTRIES.find((country) => country.code === normalizedCode) ??
    defaultPhoneCountry
  );
}

export function getPhoneCountryFromValue(
  phoneNumber?: string | null
): PhoneCountry {
  const candidateDigits = getCandidateInternationalDigits(phoneNumber ?? '');
  if (!candidateDigits) {
    return defaultPhoneCountry;
  }

  return (
    LONGEST_CALLING_CODE_FIRST.find((country) =>
      candidateDigits.startsWith(country.callingCode)
    ) ?? defaultPhoneCountry
  );
}

export function getNationalPhoneNumber(phoneNumber?: string | null): string {
  const rawValue = (phoneNumber ?? '').trim();
  const digits = normalizeDigits(rawValue);

  if (!digits) {
    return '';
  }

  const country = getPhoneCountryFromValue(rawValue);
  const candidateDigits = getCandidateInternationalDigits(rawValue);

  if (candidateDigits.startsWith(country.callingCode)) {
    return candidateDigits.slice(country.callingCode.length);
  }

  return digits;
}

export function formatPhoneNumberForCountry(
  phoneNumber: string,
  country: Pick<PhoneCountry, 'callingCode'>
): string {
  const rawValue = phoneNumber.trim();
  const digits = normalizeDigits(phoneNumber);

  if (!digits) {
    return '';
  }

  const nationalDigits =
    (rawValue.startsWith('+') && digits.startsWith(country.callingCode)) ||
    digits.startsWith(country.callingCode)
      ? digits.slice(country.callingCode.length)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return `+${country.callingCode}${nationalDigits}`;
}
