import { Alert } from 'react-native';
import { dedupeSavedAddressesById } from '@/lib/checkout-saved-address';
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

interface SavedAddressesSnapshot {
  addresses: Address[];
  updatedAt: string | null;
}

// Fresh read of the saved_addresses JSONB column together with the row's
// updated_at (auto-touched by the customers BEFORE UPDATE trigger), which acts
// as the optimistic-concurrency version for the write below.
async function fetchSavedAddressesSnapshot(
  customerId: string,
  merchantId: string
): Promise<SavedAddressesSnapshot> {
  const { data, error: fetchError } = await supabase
    .from('customers')
    .select('saved_addresses, updated_at')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError) throw fetchError;

  return {
    addresses: Array.isArray(data?.saved_addresses)
      ? (data.saved_addresses as Address[])
      : [],
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
  };
}

// Optimistic-concurrency write: the update only matches when the row still
// carries the updated_at we read the snapshot under, so a concurrent edit on
// another device cannot be silently overwritten. One retry re-applies the
// mutation to fresh data before giving up.
async function writeSavedAddresses(
  customerId: string,
  merchantId: string,
  mutate: (current: Address[]) => Address[]
): Promise<Address[]> {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const snapshot = await fetchSavedAddressesSnapshot(customerId, merchantId);
    const next = normalizeSavedAddresses(
      dedupeSavedAddressesById(mutate(snapshot.addresses))
    );

    const scopedUpdate = supabase
      .from('customers')
      .update({ saved_addresses: next })
      .eq('id', customerId)
      .eq('merchant_id', merchantId);
    const query =
      snapshot.updatedAt === null
        ? scopedUpdate.is('updated_at', null)
        : scopedUpdate.eq('updated_at', snapshot.updatedAt);
    const { data, error: updateError } = await query.select('id');

    if (updateError) throw updateError;
    if (data && data.length > 0) {
      return next;
    }
    // Zero matched rows under a version guard means the row was touched
    // between our read and write (or vanished): retry once from fresh data.
    if (attempt === MAX_ATTEMPTS) {
      throw new Error('No matching customer row updated');
    }
  }
  throw new Error('No matching customer row updated');
}

// Read a single saved address by id for the edit form. Throws on fetch error so
// the screen's promise chain (not its body) owns the try/catch.
export async function fetchSavedAddress(
  customerId: string,
  merchantId: string,
  addressId: string
): Promise<Address | null> {
  const { addresses } = await fetchSavedAddressesSnapshot(
    customerId,
    merchantId
  );
  return addresses.find((a) => a.id === addressId) ?? null;
}

// Create or update a single saved address against freshly fetched, version-
// guarded data, so a stale snapshot or a deleted address can't silently no-op
// or clobber the save.
export async function persistAddress(params: {
  addressId: string;
  customerId: string;
  form: AddressFormData;
  isNewAddress: boolean;
  merchantId: string;
}): Promise<void> {
  const { addressId, customerId, form, isNewAddress, merchantId } = params;

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

  await writeSavedAddresses(customerId, merchantId, (current) => {
    let addresses = current;
    if (form.is_default) {
      addresses = addresses.map((a) => ({ ...a, is_default: false }));
    }

    if (isNewAddress) {
      return [...addresses, addressEntry];
    }
    if (!addresses.some((a) => a.id === addressId)) {
      // The edited address vanished (deleted elsewhere or stale deep link);
      // surface the mismatch instead of silently no-op'ing the update.
      throw new Error('Address no longer exists');
    }
    return addresses.map((a) => (a.id === addressId ? addressEntry : a));
  });
}

// Hoisted out of the screen body: try/catch with `throw` in a component body
// blocks React Compiler memoization.
export async function persistDefaultAddress(
  params: MutateSavedAddressParams
): Promise<boolean> {
  try {
    await writeSavedAddresses(
      params.customerId,
      params.merchantId,
      (current) => {
        if (!current.some((address) => address.id === params.addressId)) {
          throw new Error('Address no longer exists');
        }
        return current.map((address) => ({
          ...address,
          is_default: address.id === params.addressId,
        }));
      }
    );
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
    return await writeSavedAddresses(
      params.customerId,
      params.merchantId,
      (current) => current.filter((item) => item.id !== params.addressId)
    );
  } catch (deleteError) {
    log.error('Error deleting address:', deleteError);
    Alert.alert('Error', 'Failed to delete address');
    return null;
  }
}
