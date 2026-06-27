import type { NormalizedImportedCustomer } from '@/lib/imports/bumpa/bumpa-types';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizePrice,
  sanitizeText,
} from '@/lib/sanitize-core';

export { buildItems } from './build-bumpa-order-items';

export function parseMoney(value: string) {
  return sanitizePrice(value || '0');
}

export function parseIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = trimmed.includes('T')
    ? new Date(trimmed)
    : new Date(trimmed.replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function mapPaymentStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

  if (normalized === 'PAID') return 'paid';
  if (normalized === 'PARTIALLY_PAID') return 'partially_paid';
  if (normalized === 'REFUNDED') return 'refunded';
  if (normalized === 'PENDING') return 'pending';
  if (normalized === 'FAILED') return 'failed';

  return 'unpaid';
}

export function mapShippingStatus(status: string, shippingStatus: string) {
  const normalizedStatus = status.trim().toUpperCase().replace(/\s+/g, '_');
  const normalizedShipping = shippingStatus
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalizedStatus === 'CANCELLED') return 'cancelled';
  if (normalizedShipping === 'RETURNED') return 'returned';
  if (normalizedShipping === 'DELIVERED') return 'delivered';
  if (normalizedShipping === 'SHIPPED') return 'shipped';
  if (normalizedStatus === 'COMPLETED') return 'delivered';
  if (normalizedStatus === 'PROCESSING') return 'processing';
  if (normalizedStatus === 'OPEN') return 'pending';

  return 'pending';
}

export function splitCustomerName(fullName: string) {
  const cleanName = sanitizeText(fullName);
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function normalizePhoneKey(value: string) {
  return sanitizePhone(value).replace(/[\s()-]+/g, '');
}

export function buildCustomer(row: {
  'Customer Name': string;
  'Customer Email': string;
  'Customer Phone': string;
}): NormalizedImportedCustomer {
  const fullName = sanitizeText(row['Customer Name']) || 'Customer';
  const { firstName, lastName } = splitCustomerName(fullName);
  const email = row['Customer Email']
    ? sanitizeEmail(row['Customer Email'])
    : null;
  const phone = row['Customer Phone']
    ? normalizePhoneKey(row['Customer Phone'])
    : null;

  if (email) {
    return { fullName, firstName, lastName, email, phone, claimable: true };
  }

  if (phone) {
    return {
      fullName,
      firstName,
      lastName,
      email: null,
      phone,
      claimable: false,
    };
  }

  return {
    fullName,
    firstName,
    lastName,
    email: null,
    phone: null,
    claimable: false,
  };
}
