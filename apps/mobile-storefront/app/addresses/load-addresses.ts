import { createLogger } from '@/lib/logger';
import { normalizeSavedAddresses } from '@/lib/saved-addresses';
import { supabase } from '@/lib/supabase';
import type { Address } from '@/components/addresses/types';

const log = createLogger('Addresses');

type LoadAddressesParams = {
  customerId?: string;
  isMountedRef: { current: boolean };
  merchantId: string | null;
  setAddresses: (addresses: Address[]) => void;
  setError: (message: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsRefreshing: (isRefreshing: boolean) => void;
  settleLoading?: boolean;
  settleRefreshing?: boolean;
};

async function fetchSavedAddresses(customerId: string, merchantId: string) {
  const { data, error: fetchError } = await supabase
    .from('customers')
    .select('saved_addresses')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const parsed = Array.isArray(data?.saved_addresses)
    ? (data.saved_addresses as Address[])
    : [];
  const normalized = normalizeSavedAddresses(parsed);

  normalized.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));

  return normalized;
}

export async function loadAddresses({
  customerId,
  isMountedRef,
  merchantId,
  setAddresses,
  setError,
  setIsLoading,
  setIsRefreshing,
  settleLoading = false,
  settleRefreshing = false,
}: LoadAddressesParams) {
  if (!customerId || !merchantId) {
    if (isMountedRef.current) {
      if (settleLoading) {
        setIsLoading(false);
      }
      if (settleRefreshing) {
        setIsRefreshing(false);
      }
    }
    return;
  }

  try {
    const normalized = await fetchSavedAddresses(customerId, merchantId);
    if (!isMountedRef.current) {
      return;
    }
    setAddresses(normalized);
    setError(null);
  } catch (fetchError) {
    if (!isMountedRef.current) {
      return;
    }
    log.error('Error fetching addresses:', fetchError);
    setError('Failed to load addresses');
  } finally {
    if (isMountedRef.current) {
      if (settleLoading) {
        setIsLoading(false);
      }
      if (settleRefreshing) {
        setIsRefreshing(false);
      }
    }
  }
}
