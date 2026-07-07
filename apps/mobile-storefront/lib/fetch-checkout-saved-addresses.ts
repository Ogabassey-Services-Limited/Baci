import { withSupabaseRetry } from '@/lib/api';
import {
  dedupeSavedAddressesById,
  type SavedAddress,
} from '@/lib/checkout-saved-address';
import { supabase } from '@/lib/supabase';
import { trackFetchFailure } from '@/services/track-fetch-failure';

/**
 * Load the customer's saved checkout addresses, default address first.
 *
 * Fail-open by design: every failure resolves to `[]` so checkout always
 * falls back to manual address entry. Failures are classified before
 * reporting — intentional aborts (unmount/navigation) are not errors, a
 * missing customer row is an empty state, and transient network failures
 * are retried by `withSupabaseRetry` before anything is reported.
 */
export async function fetchCheckoutSavedAddresses({
  customerId,
  merchantId,
  signal,
}: {
  customerId: string;
  merchantId: string;
  signal?: AbortSignal;
}): Promise<SavedAddress[]> {
  try {
    const { data, error } = await withSupabaseRetry(
      async () => {
        const query = supabase
          .from('customers')
          .select('saved_addresses')
          .eq('id', customerId)
          .eq('merchant_id', merchantId);
        // maybeSingle (not single): a customer without a row is an empty
        // state, not a PGRST116 error worth alerting on.
        return await (signal ? query.abortSignal(signal) : query).maybeSingle();
      },
      { maxRetries: 2 }
    );

    if (error) {
      throw error;
    }

    const row = (data ?? null) as { saved_addresses?: unknown } | null;
    const savedAddresses = row?.saved_addresses;
    const addresses = Array.isArray(savedAddresses)
      ? ([...savedAddresses] as SavedAddress[])
      : [];

    addresses.sort(
      (left, right) =>
        Number(Boolean(right.is_default)) - Number(Boolean(left.is_default))
    );
    // The stored `saved_addresses` JSON can repeat the same id (content-matched
    // upserts race on concurrent saves), which collides on the React key when
    // rendered. De-dupe at the data boundary, after the default-first sort.
    return dedupeSavedAddressesById(addresses);
  } catch (error) {
    // Checkout unmounted mid-retry: withSupabaseRetry can surface an earlier
    // retryable result after aborted attempts — that is lifecycle noise, not
    // a production failure.
    if (signal?.aborted) {
      return [];
    }
    trackFetchFailure(
      'checkout_saved_addresses_fetch',
      error,
      { request_surface: 'checkout' },
      { callerAborted: false }
    );
    return [];
  }
}
