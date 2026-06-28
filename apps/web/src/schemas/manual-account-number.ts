export const MANUAL_ACCOUNT_NUMBER_MIN_NORMALIZED_LENGTH = 6;
export const MANUAL_ACCOUNT_NUMBER_MAX_NORMALIZED_LENGTH = 34;

export const manualAccountNumberCharactersPattern =
  /^[A-Za-z0-9][A-Za-z0-9 -]*$/;

export function normalizeManualAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/[ -]/g, '');
}

export function isValidManualAccountNumber(accountNumber: string): boolean {
  const normalizedAccountNumber = normalizeManualAccountNumber(accountNumber);

  return (
    manualAccountNumberCharactersPattern.test(accountNumber) &&
    normalizedAccountNumber.length >=
      MANUAL_ACCOUNT_NUMBER_MIN_NORMALIZED_LENGTH &&
    normalizedAccountNumber.length <=
      MANUAL_ACCOUNT_NUMBER_MAX_NORMALIZED_LENGTH
  );
}
