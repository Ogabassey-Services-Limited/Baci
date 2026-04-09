/**
 * Phone number formatting utilities
 *
 * Shared across integrations (MyCover, Juicyway, etc.)
 */

/**
 * Format phone number to E.164 format (+234...)
 */
export function formatPhoneToE164(phone: string, countryCode = '+234'): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }

  const normalized = digits.startsWith('0') ? digits.slice(1) : digits;

  if (!normalized) return '';

  return `${countryCode}${normalized}`;
}

/**
 * Format phone number for MyCover API (234... without + prefix)
 */
export function formatPhoneForMyCover(phone: string): string {
  const e164 = formatPhoneToE164(phone);
  return e164.replace(/^\+/, '');
}
