/**
 * Normalizes checkout phone input, with special handling for Nigerian numbers.
 *
 * Supported Nigerian formats:
 * - +2348012345678
 * - 2348012345678
 * - 08012345678
 * - 8012345678
 *
 * Other international numbers with a leading plus are preserved as E.164-like
 * output after non-digit characters are removed.
 */
export function normalizeCheckoutPhone(
  value: string | null | undefined
): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const cleaned = trimmed.replace(/[^\d+]/g, '');
  const hasPlusPrefix = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('234') && digits.length >= 13) {
    const nationalNumber = digits.slice(3).replace(/^0/, '');
    return `+234${nationalNumber}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+234${digits.slice(1)}`;
  }

  // Handle 10-digit numbers missing the leading zero (e.g. 8012345678)
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `+234${digits}`;
  }

  if (hasPlusPrefix) {
    return `+${digits}`;
  }

  return digits;
}
