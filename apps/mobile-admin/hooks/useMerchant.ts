/**
 * useMerchant Hook
 * Fetches merchant data and primary domain from Supabase
 * 2025 Best Practice: Uses authenticated user ID
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
  vat_registration_status:
    | 'not_registered'
    | 'registered'
    | 'exempt'
    | 'pending'
    | null;
  vat_rate: number | null;
  payout_currency: string | null;
  country: string | null;
  bank_code: string | null;
  bank_account_number: string | null;
  paystack_subaccount_code: string | null;
  nin: string | null;
  bvn: string | null;
  cac_rc_number: string | null;
  support_email: string | null;
  support_phone: string | null;
  business_address: string | null;
  social_media: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
  } | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  snapchat_pixel_id: string | null;
  twitter_pixel_id: string | null;
  hero_slides: any[] | null;
  brand_colors?: {
    primary: string;
    background: string;
    accent: string;
  };
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

async function fetchMerchantData(
  userId: string
): Promise<{ merchant: Merchant | null; primaryDomain: Domain | null }> {
  console.log('[Merchant] Fetching merchant for user:', userId);

  // Fetch merchant by authenticated user ID
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select(`
      id, user_id, email, business_name, slug, logo_url, favicon_png_192_url, is_published, phone, 
      vat_registration_status, vat_rate, payout_currency, brand_colors,
      country, bank_code, bank_account_number, paystack_subaccount_code,
      nin, bvn, cac_rc_number, support_email, support_phone, business_address,
      social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, 
      snapchat_pixel_id, twitter_pixel_id, hero_slides
    `)
    .eq('user_id', userId)
    .single();

  console.log('[Merchant] Result:', merchant, 'Error:', merchantError);

  if (merchantError) {
    // No merchant found for this user
    if (merchantError.code === 'PGRST116') {
      console.log('[Merchant] No merchant found for user');
      return { merchant: null, primaryDomain: null };
    }
    throw new Error(merchantError.message);
  }

  // Fetch primary domain if merchant exists
  let primaryDomain: Domain | null = null;
  if (merchant) {
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id, domain, is_primary, status, domain_type')
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
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['merchant', user?.id],
    queryFn: () => fetchMerchantData(user!.id),
    enabled: !!user?.id, // Only fetch when user is authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const merchant = data?.merchant ?? null;
  const primaryDomain = data?.primaryDomain ?? null;

  // Determine store URL: primary domain > slug.mybaci.store
  let storeUrl = '';
  if (primaryDomain?.domain) {
    storeUrl = primaryDomain.domain;
  } else if (merchant?.slug) {
    storeUrl = `${merchant.slug}.usebaci.com`;
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
