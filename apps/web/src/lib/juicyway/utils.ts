/**
 * Juicyway Utility Functions
 */

import { JUICYWAY_BASE_URL, JUICYWAY_SECRET_KEY } from './client';
import {
  JUICYWAY_CURRENCIES,
  type JuicywayCryptoChain,
  type JuicywayCurrency,
} from './types';

/**
 * Get estimated confirmation time for a blockchain network
 */
export function getChainConfirmationTime(chain: JuicywayCryptoChain): string {
  const confirmationTimes: Record<JuicywayCryptoChain, string> = {
    TRX: '1-3 minutes',
    ETH: '5-30 minutes',
    MATIC: '1-5 minutes',
    AVAXC: '1-5 minutes',
  };
  return confirmationTimes[chain];
}

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(prefix = 'baci'): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.getRandomValues(new Uint8Array(4));
  const randomStr = Array.from(random)
    .map((b) => b.toString(36))
    .join('');
  return `${prefix}_${timestamp}_${randomStr}`.substring(0, 50);
}

/**
 * Format phone number to E.164 format
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
 * Check if Juicyway is properly configured
 */
export function isJuicywayConfigured(): boolean {
  return Boolean(JUICYWAY_SECRET_KEY);
}

/**
 * Get the current environment mode
 */
export function getJuicywayMode(): 'sandbox' | 'live' {
  return JUICYWAY_BASE_URL.includes('sandbox') ? 'sandbox' : 'live';
}

/**
 * Validate if a currency is supported
 */
export function isSupportedCurrency(
  currency: string
): currency is JuicywayCurrency {
  return JUICYWAY_CURRENCIES.includes(currency as JuicywayCurrency);
}
