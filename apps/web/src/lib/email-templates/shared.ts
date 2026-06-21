import { formatDisplayCurrency } from '@/lib/format-display-currency';
import { escapeHtmlAttribute } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface MerchantRegistrationInfo {
  merchantTin?: string;
  merchantRcNumber?: string;
}

export interface PaymentReminderItem {
  name: string;
  quantity: number;
  price: number;
}

export function formatEmailMoney(amount: number, currency?: string): string {
  return formatDisplayCurrency(amount, currency || 'NGN');
}

export function getSafeHttpUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return sanitizeUrl(value) || undefined;
}

export function buildEscapedRegistrationLine(
  data: MerchantRegistrationInfo
): string {
  const parts: string[] = [];
  if (data.merchantRcNumber) {
    parts.push(`RC: ${escapeHtmlAttribute(data.merchantRcNumber)}`);
  }
  if (data.merchantTin) {
    parts.push(`TIN: ${escapeHtmlAttribute(data.merchantTin)}`);
  }
  return parts.join(' &middot; ');
}
