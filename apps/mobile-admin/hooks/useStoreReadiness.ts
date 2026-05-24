import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SetupItem, StoreReadiness } from '@/types/readiness';
import { useMerchant } from './useMerchant';

interface VerificationFlags {
  nin_verified: boolean;
  bvn_verified: boolean;
  cac_verified: boolean;
}

const UNVERIFIED_FLAGS: VerificationFlags = {
  nin_verified: false,
  bvn_verified: false,
  cac_verified: false,
};

function isVerificationFlags(value: unknown): value is VerificationFlags {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.nin_verified === 'boolean' &&
    typeof v.bvn_verified === 'boolean' &&
    typeof v.cac_verified === 'boolean'
  );
}

export function useStoreReadiness() {
  const { merchant, isLoading: isMerchantLoading } = useMerchant();

  const {
    data: readiness,
    isLoading: isReadinessLoading,
    refetch,
  } = useQuery({
    queryKey: ['store-readiness', merchant?.id],
    queryFn: async () => {
      if (!merchant) return null;

      // Get published product count
      const { count: publishedProductCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

      // KYC readiness must match the publish gate, which checks *verified*
      // flags on merchant_verifications (not mere presence of
      // nin/bvn/cac_rc_number on the merchant row). Using the same source
      // prevents the UI from advertising "Ready to Launch" while POST
      // /api/merchant/publish returns 400 on unverified identifiers.
      // The staff-safe `get_merchant_verification_flags` RPC authorises
      // owners and any staff with `settings.edit` (same permission the
      // publish endpoint requires), so staff sessions see an accurate
      // readiness state instead of a permanently-false KYC item. Any
      // authorisation or network failure falls back to "unverified"
      // rather than throwing — that keeps consumer screens from
      // rendering `null` and losing state.
      let verification: VerificationFlags = UNVERIFIED_FLAGS;
      const { data: verificationData, error: verificationError } =
        await supabase.rpc('get_merchant_verification_flags', {
          p_merchant_id: merchant.id,
        });
      if (verificationError) {
        if (__DEV__) {
          console.warn(
            '[StoreReadiness] verification lookup failed; defaulting to unverified',
            verificationError
          );
        }
      } else if (isVerificationFlags(verificationData)) {
        verification = verificationData;
      }
      const hasVerifiedIdentity =
        verification.nin_verified ||
        verification.bvn_verified ||
        verification.cac_verified;

      const items: SetupItem[] = [
        // === REQUIRED ITEMS ===
        {
          id: 'verify_kyc',
          label: 'Verify your identity (KYC)',
          description: 'NIN, BVN, or CAC required for payments',
          completed: hasVerifiedIdentity,
          href: '/kyc',
          priority: 'required',
          category: 'payments',
        },
        {
          id: 'bank_account',
          label: 'Add bank account',
          description: 'Required to receive payments via Paystack',
          completed: !!(
            merchant.bank_code &&
            merchant.bank_account_number &&
            merchant.paystack_subaccount_code
          ),
          href: '/payout-settings',
          priority: 'required',
          category: 'payments',
        },
        {
          id: 'first_product',
          label: 'Publish your first product',
          description:
            'You need at least one published product to start selling',
          completed: (publishedProductCount || 0) > 0,
          href: '/product/new',
          priority: 'required',
          category: 'products',
        },
        {
          id: 'country',
          label: 'Set your country/region',
          description:
            'Determines currency, shipping options, and tax settings',
          completed: !!merchant.country,
          href: '/store-settings',
          priority: 'required',
          category: 'store',
        },
        {
          id: 'contact_info',
          label: 'Add contact information',
          description: 'Let customers know how to reach you',
          completed: !!(merchant.support_email || merchant.support_phone),
          href: '/store-settings',
          priority: 'required',
          category: 'store',
        },

        // === RECOMMENDED ITEMS ===
        {
          id: 'business_address',
          label: 'Add business address',
          description: 'Builds trust and may be legally required',
          completed: !!merchant.business_address,
          href: '/store-settings',
          priority: 'recommended',
          category: 'store',
        },
        {
          id: 'hero_carousel',
          label: 'Set up hero carousel',
          description: 'Add eye-catching banners to your homepage',
          // hero_slides might be explicitly typed or strictly array
          completed:
            Array.isArray(merchant.hero_slides) &&
            merchant.hero_slides.length > 0,
          href: '/customize',
          priority: 'recommended',
          category: 'marketing',
        },

        // === OPTIONAL ITEMS ===
        {
          id: 'social_media',
          label: 'Connect social media',
          description: 'Link your social profiles for better engagement',
          completed: !!(
            merchant.social_media?.instagram ||
            merchant.social_media?.facebook ||
            merchant.social_media?.twitter ||
            merchant.social_media?.tiktok
          ),
          href: '/social-media',
          priority: 'optional',
          category: 'marketing',
        },
        {
          id: 'analytics',
          label: 'Set up analytics',
          description: 'Track visitors and conversions',
          completed: !!(
            merchant.google_analytics_id ||
            merchant.facebook_pixel_id ||
            merchant.tiktok_pixel_id ||
            merchant.snapchat_pixel_id ||
            merchant.twitter_pixel_id
          ),
          href: '/analytics-config', // Redirects to settings where analytics keys are
          priority: 'optional',
          category: 'marketing',
        },
        {
          id: 'multiple_products',
          label: 'Add more products',
          description: 'Stores with 5+ published products convert better',
          completed: (publishedProductCount || 0) >= 5,
          href: '/product/new',
          priority: 'optional',
          category: 'products',
        },
      ];

      // Calculate stats
      const requiredItems = items.filter(
        (item) => item.priority === 'required'
      );
      const recommendedItems = items.filter(
        (item) => item.priority === 'recommended'
      );
      const completedRequired = requiredItems.filter(
        (item) => item.completed
      ).length;
      const completedRecommended = recommendedItems.filter(
        (item) => item.completed
      ).length;
      const totalCompleted = items.filter((item) => item.completed).length;

      const result: StoreReadiness = {
        isReady: completedRequired === requiredItems.length,
        isPublished: merchant.is_published ?? false,
        completedRequired,
        totalRequired: requiredItems.length,
        completedRecommended,
        totalRecommended: recommendedItems.length,
        overallProgress: Math.round((totalCompleted / items.length) * 100),
        items,
      };

      return result;
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    readiness,
    isLoading: isMerchantLoading || isReadinessLoading,
    refetch,
  };
}
