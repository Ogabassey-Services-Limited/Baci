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

  if (digits.startsWith('234')) {
    const nationalNumber = digits.slice(3).replace(/^0/, '');
    return `+234${nationalNumber}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+234${digits.slice(1)}`;
  }

  if (hasPlusPrefix) {
    return `+${digits}`;
  }

  return digits;
}
