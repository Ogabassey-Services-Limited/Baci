interface CountryFlagSource {
  code: string;
  flag?: string;
}

export function countryFlag(country: CountryFlagSource): string {
  if (country.flag) {
    return country.flag;
  }

  const normalizedCode = country.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return '';
  }

  return String.fromCodePoint(
    ...[...normalizedCode].map((character) => 127_397 + character.charCodeAt(0))
  );
}
