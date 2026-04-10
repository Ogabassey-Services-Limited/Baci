import { splitFullName } from './auth-helpers';
import { normalizeCheckoutPhone } from './normalize-checkout-phone';
import { normalizeSavedAddresses } from './saved-addresses';
import type { ShippingAddressInput } from './validation';

export interface SavedAddress {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  is_default?: boolean;
}

export interface CheckoutAddressValues {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getDefaultSavedAddress(
  addresses: SavedAddress[]
): SavedAddress | null {
  if (addresses.length === 0) {
    return null;
  }

  return (
    addresses.find((address) => address.is_default) ?? addresses[0] ?? null
  );
}

export function toCheckoutAddressValues(
  savedAddress: SavedAddress
): CheckoutAddressValues {
  const { firstName, lastName } = splitFullName(savedAddress.full_name);

  return {
    firstName,
    lastName,
    phone: normalizeCheckoutPhone(savedAddress.phone),
    address: savedAddress.address ?? '',
    city: savedAddress.city ?? '',
    state: savedAddress.state ?? '',
  };
}

export function buildSavedAddressFromCheckout(
  address: ShippingAddressInput,
  options?: {
    id?: string;
    label?: string;
    isDefault?: boolean;
  }
): SavedAddress {
  return {
    id: options?.id ?? crypto.randomUUID(),
    label: options?.label ?? 'Home',
    full_name: `${address.firstName} ${address.lastName}`.trim(),
    phone: normalizeCheckoutPhone(address.phone),
    address: address.address,
    city: address.city,
    state: address.state,
    country: 'Nigeria',
    is_default: options?.isDefault ?? false,
  };
}

export function findMatchingSavedAddress(
  addresses: SavedAddress[],
  address: ShippingAddressInput
): SavedAddress | null {
  return (
    addresses.find(
      (savedAddress) =>
        normalizeText(savedAddress.full_name) ===
          normalizeText(`${address.firstName} ${address.lastName}`) &&
        normalizeCheckoutPhone(savedAddress.phone) ===
          normalizeCheckoutPhone(address.phone) &&
        normalizeText(savedAddress.address) ===
          normalizeText(address.address) &&
        normalizeText(savedAddress.city) === normalizeText(address.city) &&
        normalizeText(savedAddress.state) === normalizeText(address.state)
    ) ?? null
  );
}

export function upsertSavedAddress(
  addresses: SavedAddress[],
  address: ShippingAddressInput,
  options: {
    selectedSavedAddressId?: string | null;
    setAsDefault: boolean;
  }
): SavedAddress[] {
  const existing =
    addresses.find((item) => item.id === options.selectedSavedAddressId) ??
    findMatchingSavedAddress(addresses, address);

  const nextEntry = buildSavedAddressFromCheckout(address, {
    id: existing?.id,
    label: existing?.label ?? (addresses.length === 0 ? 'Home' : 'Other'),
    isDefault: options.setAsDefault,
  });

  const nextAddresses = existing
    ? addresses.map((item) => (item.id === existing.id ? nextEntry : item))
    : [...addresses, nextEntry];

  if (!options.setAsDefault) {
    return normalizeSavedAddresses(nextAddresses);
  }

  return normalizeSavedAddresses(
    nextAddresses.map((item) => ({
      ...item,
      is_default: item.id === nextEntry.id,
    }))
  );
}
