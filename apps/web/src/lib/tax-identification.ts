export const TAX_IDENTIFICATION_NUMBER_MIN_LENGTH = 10;
export const TAX_IDENTIFICATION_NUMBER_MAX_LENGTH = 15;

const TAX_IDENTIFICATION_NUMBER_PATTERN = new RegExp(
  `^\\d{${TAX_IDENTIFICATION_NUMBER_MIN_LENGTH},${TAX_IDENTIFICATION_NUMBER_MAX_LENGTH}}$`
);

export function normalizeTaxIdentificationNumber(
  value?: string | null
): string {
  return value?.replace(/\D/g, '') ?? '';
}

export function isValidTaxIdentificationNumber(value?: string | null): boolean {
  return TAX_IDENTIFICATION_NUMBER_PATTERN.test(
    normalizeTaxIdentificationNumber(value)
  );
}
