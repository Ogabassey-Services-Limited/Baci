import { Alert } from 'react-native';
import { createLogger } from '@/lib/logger';
import { normalizeSavedAddresses } from '@/lib/saved-addresses';
import { supabase } from '@/lib/supabase';
import type { Address, AddressFormData } from './types';

const log = createLogger('Addresses');

interface MutateSavedAddressParams {
  addressId: string;
  customerId: string;
  merchantId: string;
}

// Read a single saved address by id for the edit form. Throws on fetch error so
// the screen's promise chain (not its body) owns the try/catch.
export async function fetchSavedAddress(
  customerId: string,
  merchantId: string,
  addressId: string
): Promise<Address | null> {
  const addresses = await fetchCurrentSavedAddresses(customerId, merchantId);
  return addresses.find((a) => a.id === addressId) ?? null;
}

// Create or update a single saved address against freshly fetched data and
// verify the row match, so a stale snapshot or a deleted address can't silently
// no-op the save.
export async function persistAddress(params: {
  addressId: string;
  customerId: string;
  form: AddressFormData;
  isNewAddress: boolean;
  merchantId: string;
}): Promise<void> {
  const { addressId, customerId, form, isNewAddress, merchantId } = params;

  let addresses = await fetchCurrentSavedAddresses(customerId, merchantId);

  const addressEntry: Address = {
    id: isNewAddress ? `addr_${Date.now()}` : addressId,
    label: form.label,
    full_name: form.full_name,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    country: 'Nigeria',
    postal_code: form.postal_code || undefined,
    is_default: form.is_default,
  };

  if (form.is_default) {
    addresses = addresses.map((a) => ({ ...a, is_default: false }));
  }

  if (isNewAddress) {
    addresses.push(addressEntry);
  } else {
    if (!addresses.some((a) => a.id === addressId)) {
      // The edited address vanished (deleted elsewhere or stale deep link);
      // surface the mismatch instead of silently no-op'ing the update.
      throw new Error('Address no longer exists');
    }
    addresses = addresses.map((a) => (a.id === addressId ? addressEntry : a));
  }

  addresses = normalizeSavedAddresses(addresses);

  const { data, error: updateError } = await supabase
    .from('customers')
    .update({ saved_addresses: addresses })
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .select('id');

  if (updateError) throw updateError;
  if (!data || data.length === 0) {
    throw new Error('No matching customer row updated');
  }
}

// Re-fetch the saved_addresses JSONB column immediately before a read-modify-
// write so concurrent edits on another device are not clobbered by the stale
// local snapshot held in component state.
async function fetchCurrentSavedAddresses(
  customerId: string,
  merchantId: string
): Promise<Address[]> {
  const { data, error: fetchError } = await supabase
    .from('customers')
    .select('saved_addresses')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError) throw fetchError;

  return Array.isArray(data?.saved_addresses)
    ? (data.saved_addresses as Address[])
    : [];
}

// Hoisted out of the screen body: try/catch with `throw` in a component body
// blocks React Compiler memoization.
export async function persistDefaultAddress(
  params: MutateSavedAddressParams
): Promise<boolean> {
  try {
    const current = await fetchCurrentSavedAddresses(
      params.customerId,
      params.merchantId
    );
    if (!current.some((address) => address.id === params.addressId)) {
      throw new Error('Address no longer exists');
    }
    const updated = current.map((address) => ({
      ...address,
      is_default: address.id === params.addressId,
    }));
    const { data, error: updateError } = await supabase
      .from('customers')
      .update({ saved_addresses: updated })
      .eq('id', params.customerId)
      .eq('merchant_id', params.merchantId)
      .select('id');

    if (updateError) throw updateError;
    if (!data || data.length === 0) {
      throw new Error('No matching customer row updated');
    }
    return true;
  } catch (updateError) {
    log.error('Error setting default address:', updateError);
    Alert.alert('Error', 'Failed to set default address');
    return false;
  }
}

export async function deleteAddressRecord(
  params: MutateSavedAddressParams
): Promise<Address[] | null> {
  try {
    const current = await fetchCurrentSavedAddresses(
      params.customerId,
      params.merchantId
    );
    const updated = current.filter((item) => item.id !== params.addressId);
    const normalized = normalizeSavedAddresses(updated);
    const { data, error: deleteError } = await supabase
      .from('customers')
      .update({ saved_addresses: normalized })
      .eq('id', params.customerId)
      .eq('merchant_id', params.merchantId)
      .select('id');

    if (deleteError) throw deleteError;
    if (!data || data.length === 0) {
      throw new Error('No matching customer row updated');
    }
    return normalized;
  } catch (deleteError) {
    log.error('Error deleting address:', deleteError);
    Alert.alert('Error', 'Failed to delete address');
    return null;
  }
}
