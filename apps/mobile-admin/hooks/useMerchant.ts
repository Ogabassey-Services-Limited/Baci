/**
 * useMerchant Hook
 * Fetches merchant data and primary domain from Supabase
 * 2025 Best Practice: Uses authenticated user ID
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// Defined locally to avoid Zod v3/v4 cross-version incompatibility
// (shared package uses root zod v3, mobile-admin uses zod v4)
const SocialMediaSchema = z.object({
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  tiktok: z.string().optional(),
  youtube: z.string().optional(),
  pinterest: z.string().optional(),
  linkedin: z.string().optional(),
  snapchat: z.string().optional(),
});

const RegisteredAddressSchema = z.object({
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export const MerchantSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().email(),
  business_name: z.string().nullable(),
  slug: z.string().nullable(),
  logo_url: z.string().nullable(),
  favicon_png_192_url: z.string().nullable(),
  is_published: z.boolean(),
  phone: z.string().nullable(),
  vat_registration_status: z
    .enum(['not_registered', 'registered', 'exempt', 'pending'])
    .nullable(),
  vat_rate: z.coerce.number().nullable(),
  payout_currency: z.string().nullable(),
  country: z.string().nullable(),
  bank_code: z.string().nullable(),
  bank_name: z.string().nullable(),
  bank_account_number: z.string().nullable(),
  bank_account_name: z.string().nullable(),
  paystack_subaccount_code: z.string().nullable(),
  nin: z.string().nullable(),
  bvn: z.string().nullable(),
  cac_rc_number: z.string().nullable(),
  tax_identification_number: z.string().nullable(),
  legal_entity_name: z.string().nullable(),
  support_email: z.string().email().nullable(),
  support_phone: z.string().nullable(),
  business_address: z.string().nullable(),
  social_media: SocialMediaSchema.nullable(),
  registered_address: RegisteredAddressSchema.nullable().optional(),
  state_code: z.string().nullable().optional(),
  google_analytics_id: z.string().nullable(),
  facebook_pixel_id: z.string().nullable(),
  tiktok_pixel_id: z.string().nullable(),
  snapchat_pixel_id: z.string().nullable(),
  twitter_pixel_id: z.string().nullable(),
  hero_slides: z
    .array(
      z.object({
        id: z.string(),
        imageUrl: z.string(),
        headline: z.string().optional(),
        description: z.string().optional(),
        cta: z.string().optional(),
      })
    )
    .nullable(),
  brand_colors: z
    .object({
      primary: z.string(),
      background: z.string(),
      accent: z.string(),
    })
    .optional(),
});

export type Merchant = z.infer<typeof MerchantSchema>;
export type MerchantSocialMedia = NonNullable<Merchant['social_media']>;
export type MerchantRegisteredAddress = NonNullable<
  Merchant['registered_address']
>;

export const DomainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  domain_type: z.enum(['subdomain', 'custom', 'purchased']),
  is_primary: z.boolean(),
  status: z.string(),
});

export type Domain = z.infer<typeof DomainSchema>;

export const MerchantContextSchema = z.object({
  merchant: MerchantSchema.nullable(),
  primaryDomain: DomainSchema.nullable(),
});

export interface MerchantData {
  merchant: Merchant | null;
  primaryDomain: Domain | null;
  storeUrl: string;
  isLive: boolean;
  isLoading: boolean;
  error: Error | null;
}

function isMerchantNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    details?: unknown;
    message?: unknown;
  };

  return [candidate.message, candidate.details].some(
    (value) =>
      typeof value === 'string' &&
      value.toLowerCase().includes('network request failed')
  );
}

export async function fetchMerchantData(
  userId: string
): Promise<{ merchant: Merchant | null; primaryDomain: Domain | null }> {
  if (__DEV__) {
    console.log('[Merchant] Fetching context for user:', userId);
  }

  // Call the RPC function to get context in a single round-trip
  // This handles both Owner and Staff logic on the server
  const { data, error } = await supabase.rpc('get_user_merchant_context');

  if (error) {
    if (isMerchantNetworkFailure(error)) {
      console.warn('[Merchant] Network unavailable while fetching context');
      throw new Error(
        'Unable to load merchant data right now. Check your connection and try again.'
      );
    }

    console.error('[Merchant] RPC Error:', error);
    throw new Error(error.message);
  }

  if (!data) {
    if (__DEV__) {
      console.log('[Merchant] No merchant context found for user');
    }
    return { merchant: null, primaryDomain: null };
  }

  // data is typed as any from RPC, so we cast and validate it
  const { data: result, error: validationError } =
    MerchantContextSchema.safeParse(data);

  if (validationError) {
    console.error('[Merchant] Validation Error:', validationError);
    // Return partial data or throw depending on how critical this is.
    // In 2026, we prefer failing fast if critical data is malformed.
    throw new Error('Merchant context data validation failed');
  }

  return {
    merchant: result.merchant,
    primaryDomain: result.primaryDomain,
  };
}

export function useMerchant(): MerchantData {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['merchant', user?.id],
    queryFn: () => {
      if (!user?.id) throw new Error('No user authenticated');
      return fetchMerchantData(user.id);
    },
    enabled: !!user?.id, // Only fetch when user is authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, queryError) =>
      !isMerchantNetworkFailure(queryError) && failureCount < 1,
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
