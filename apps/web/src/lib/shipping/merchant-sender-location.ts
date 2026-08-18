import type { RegisteredAddress } from '@baci/shared';
import {
  getSubdivisions,
  resolveSubdivisionCode,
} from './merchant-rates/subdivisions';
import { deriveMerchantLocation } from './order-shipment-booking-utils';
import type { ShippingAddress } from './types';

type MerchantSenderDetails = {
  businessAddress: string | null;
  businessName: string | null;
  phone: string | null;
  registeredAddress: unknown;
  stateCode: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPostalCode(record: Record<string, unknown>): string | null {
  const value = record.postal_code ?? record.postalCode;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseRegisteredAddress(value: unknown): RegisteredAddress | null {
  if (!isRecord(value)) return null;

  const address: RegisteredAddress = {
    city: readString(value, 'city'),
    country: readString(value, 'country'),
    postal_code: readPostalCode(value),
    state: readString(value, 'state'),
    street: readString(value, 'street'),
  };

  return Object.values(address).some(Boolean) ? address : null;
}

function hasLetters(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && /[a-z]/i.test(value));
}

function resolveStateFromCode(stateCode: string | null): string | null {
  const normalized = stateCode?.trim().toUpperCase();
  if (!normalized) return null;

  const subdivisionCode = normalized.startsWith('NG-')
    ? normalized
    : normalized.length === 2
      ? `NG-${normalized}`
      : resolveSubdivisionCode('NG', normalized);
  if (!subdivisionCode) return null;

  const subdivision = getSubdivisions('NG').find(
    (candidate) => candidate.code === subdivisionCode
  );
  return subdivision?.name.replace(/\s+\(FCT\)$/i, '') ?? null;
}

function formatRegisteredAddress(address: RegisteredAddress): string {
  return [address.street, address.city, address.state, address.postal_code]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

export function buildMerchantSenderInfo(
  details: MerchantSenderDetails
): ShippingAddress {
  const registeredAddress = parseRegisteredAddress(details.registeredAddress);
  const addressValue =
    details.businessAddress?.trim() ||
    (registeredAddress ? formatRegisteredAddress(registeredAddress) : 'Lagos');
  const location = deriveMerchantLocation(addressValue);
  const structuredState = hasLetters(registeredAddress?.state)
    ? registeredAddress?.state
    : null;
  const state = structuredState || resolveStateFromCode(details.stateCode);

  return {
    name: details.businessName || 'Merchant',
    phone: details.phone || '',
    address: location.address,
    city: registeredAddress?.city || location.city,
    state: state || (hasLetters(location.state) ? location.state : 'Lagos'),
    country: 'Nigeria',
    countryCode: 'NG',
    postalCode: registeredAddress?.postal_code ?? undefined,
  };
}
