/**
 * useMerchant Hook
 * Fetches merchant data and primary domain from Supabase
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Merchant {
  id: string;
  user_id: string;
  email: string;
  business_name: string | null;
  slug: string | null;
  logo_url: string | null;
  favicon_png_192_url: string | null;
  is_published: boolean;
  phone: string | null;
}

export interface Domain {
  id: string;
  domain: string;
  is_primary: boolean;
  status: string;
}

export interface MerchantData {
  merchant: Merchant | null;
  primaryDomain: Domain | null;
  storeUrl: string;
  isLive: boolean;
  isLoading: boolean;
  error: Error | null;
}

// TODO: Replace with actual auth when login is implemented
const DEV_MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74'; // ogabassey

async function fetchMerchantData(): Promise<{ merchant: Merchant | null; primaryDomain: Domain | null }> {
  console.log('[Merchant] Fetching merchant:', DEV_MERCHANT_ID);

  // For development, use hardcoded merchant ID
  // TODO: Replace with actual auth flow
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, user_id, email, business_name, slug, logo_url, favicon_png_192_url, is_published, phone')
    .eq('id', DEV_MERCHANT_ID)
    .single();

  console.log('[Merchant] Result:', merchant, 'Error:', merchantError);

  if (merchantError) {
    throw new Error(merchantError.message);
  }

  // Fetch primary domain if merchant exists
  let primaryDomain: Domain | null = null;
  if (merchant) {
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id, domain, is_primary, status')
      .eq('merchant_id', merchant.id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .single();

    console.log('[Merchant] Domain:', domain, 'Error:', domainError);
    primaryDomain = domain;
  }

  return { merchant, primaryDomain };
}

export function useMerchant(): MerchantData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['merchant'],
    queryFn: fetchMerchantData,
    staleTime: 1000 * 30, // 30 seconds for dev
    retry: 1,
  });

  const merchant = data?.merchant ?? null;
  const primaryDomain = data?.primaryDomain ?? null;

  // Determine store URL: primary domain > slug.mybaci.store
  let storeUrl = '';
  if (primaryDomain?.domain) {
    storeUrl = primaryDomain.domain;
  } else if (merchant?.slug) {
    storeUrl = `${merchant.slug}.mybaci.store`;
  }

  return {
    merchant,
    primaryDomain,
    storeUrl,
    isLive: merchant?.is_published ?? false,
    isLoading,
    error: error as Error | null,
  };
}
