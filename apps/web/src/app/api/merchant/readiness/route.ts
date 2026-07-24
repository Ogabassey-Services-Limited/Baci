import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getLaunchPaymentRequirement,
  requiresNigerianKycForLaunch,
} from '@/lib/checkout/payment-gateway-availability';
import { fetchMerchantPaystackConfigured } from '@/lib/fetch-merchant-paystack-configured';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  buildStoreBuildStatus,
  type StoreBuildStatus,
  type StorefrontBuildJob,
} from '@/lib/store-build-status';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface MerchantVerificationFlags {
  nin_verified: boolean;
  bvn_verified: boolean;
  cac_verified: boolean;
}

/**
 * Returns the verified flags from merchant_verifications for the given
 * merchant. Uses the admin (service-role) client because the underlying
 * table denies reads from `authenticated` via RLS. Auth + permission
 * checks have already been enforced by the caller; this function only
 * reads three boolean columns keyed by `merchant_id`.
 *
 * Throws on DB errors so the caller surfaces them as a 5xx. Collapsing
 * failures into `false` would misclassify backend outages as user-side
 * KYC gaps and leave the readiness UI perpetually incomplete.
 */
async function getVerificationFlags(
  merchantId: string
): Promise<MerchantVerificationFlags> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchant_verifications')
    .select('nin_verified, bvn_verified, cac_verified')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('[Readiness API] merchant_verifications read failed:', error);
    throw new Error('Failed to load verification status');
  }

  return {
    nin_verified: !!data?.nin_verified,
    bvn_verified: !!data?.bvn_verified,
    cac_verified: !!data?.cac_verified,
  };
}

/**
 * Store Readiness API
 *
 * GET - Check merchant's store readiness status
 * Returns a checklist of required and recommended setup items
 */

export interface SetupItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
  priority: 'required' | 'recommended' | 'optional';
  category: 'payments' | 'products' | 'store' | 'legal' | 'marketing';
}

export interface StoreReadiness {
  isReady: boolean;
  isPublished: boolean;
  completedRequired: number;
  totalRequired: number;
  completedRecommended: number;
  totalRecommended: number;
  overallProgress: number;
  items: SetupItem[];
  storeBuild: StoreBuildStatus;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve merchant context for permission check
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Permission check
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-secret merchant columns remain granted to the `authenticated`
    // Postgres role, so read the merchant row (owned, or resolved via the
    // staff_members -> merchants join) on the auth-scoped client. The secret
    // `paystack_subaccount_code` is REVOKED from that role and is fetched
    // separately below via a bounded RPC. The `.eq('user_id', user.id)` and
    // staff-membership filters are preserved verbatim, so scoping to the
    // caller's own or staffed merchant is unchanged.

    // Get merchant with all relevant fields (only columns that exist in the table)
    // KYC readiness is derived from merchant_verifications — the legacy
    // nin/bvn/cac_rc_number columns on `merchants` are no longer read here.
    const { data: ownedMerchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id,
        business_name,
        email,
        phone,
        country,
        logo_url,
        support_email,
        support_phone,
        business_address,
        bank_code,
        bank_account_number,
        social_media,
        pages,
        hero_slides,
        google_analytics_id,
        facebook_pixel_id,
        tiktok_pixel_id,
        snapchat_pixel_id,
        twitter_pixel_id,
        is_published
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    // Get merchant - either as owner or staff member
    const baseMerchant = await (async () => {
      // First, check if user owns a merchant directly
      if (!merchantError && ownedMerchant) {
        return ownedMerchant;
      }

      // User is not a merchant owner, check if they are staff
      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          merchant_id,
          merchants (
            id,
            business_name,
            email,
            phone,
            country,
            logo_url,
            support_email,
            support_phone,
            business_address,
            bank_code,
            bank_account_number,
            social_media,
            pages,
            hero_slides,
            google_analytics_id,
            facebook_pixel_id,
            tiktok_pixel_id,
            snapchat_pixel_id,
            twitter_pixel_id,
            is_published
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (staffError || !staffMember) {
        console.error('[Readiness API] Merchant/Staff lookup failed:', {
          userId: user.id,
          merchantError,
          staffError,
        });
        return null;
      }

      // Extract merchant from staff join (handling potential array)
      const merchantData = Array.isArray(staffMember.merchants)
        ? staffMember.merchants[0]
        : staffMember.merchants;

      if (!merchantData) {
        return null;
      }

      // Cast to same type as direct merchant query
      return merchantData as typeof ownedMerchant;
    })();

    if (!baseMerchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Readiness only needs CONFIGURED-NESS, not the raw secret: the launch
    // gate natively honors `paystack_subaccount_configured`. The derived
    // boolean RPC is owner/active-staff scoped, so accountant/sales_rep and
    // other dashboard.view-only roles keep an accurate checklist.
    const validMerchant = {
      ...baseMerchant,
      paystack_subaccount_configured: await fetchMerchantPaystackConfigured(
        supabase,
        baseMerchant.id
      ),
    };

    const [
      { count: publishedProductCount },
      { data: latestStorefrontJob, error: latestStorefrontJobError },
      { data: homePageConfig, error: homePageConfigError },
      { data: featureSettings, error: featureSettingsError },
    ] = await Promise.all([
      supabase
        .from('products')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', validMerchant.id)
        .eq('status', 'active'),
      supabase
        .from('ai_jobs')
        .select('id, status, error, result_applied_at, created_at')
        .eq('merchant_id', validMerchant.id)
        .eq('type', 'storefront_layout_generation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<StorefrontBuildJob>(),
      supabase
        .from('page_configs')
        .select('id')
        .eq('merchant_id', validMerchant.id)
        .eq('page_slug', 'home')
        .maybeSingle(),
      supabase
        .from('merchant_feature_settings')
        .select('paystack_enabled, korapay_enabled, pay_on_delivery_enabled')
        .eq('merchant_id', validMerchant.id)
        .maybeSingle(),
    ]);

    if (latestStorefrontJobError) {
      console.error(
        '[Readiness API] ai_jobs storefront status read failed:',
        latestStorefrontJobError
      );
      return NextResponse.json(
        {
          error: 'Failed to load storefront build status',
          code: 'STOREFRONT_JOB_LOAD_FAILED',
        },
        { status: 500 }
      );
    }

    if (homePageConfigError) {
      console.error(
        '[Readiness API] page_configs starter status read failed:',
        homePageConfigError
      );
      return NextResponse.json(
        {
          error: 'Failed to load starter storefront status',
          code: 'PAGE_CONFIG_LOAD_FAILED',
        },
        { status: 500 }
      );
    }

    if (featureSettingsError) {
      console.error(
        '[Readiness API] merchant_feature_settings read failed:',
        featureSettingsError
      );
      return NextResponse.json(
        {
          error: 'Failed to load payment settings',
          code: 'PAYMENT_SETTINGS_LOAD_FAILED',
        },
        { status: 500 }
      );
    }

    const storeBuild = buildStoreBuildStatus(
      !!homePageConfig,
      latestStorefrontJob,
      hasPermission(access, 'builder', 'edit')
    );

    const paymentMerchant = {
      ...validMerchant,
      feature_settings: featureSettings ?? undefined,
    };
    const kycRequired = requiresNigerianKycForLaunch(paymentMerchant);
    const paymentRequirement = getLaunchPaymentRequirement(paymentMerchant);

    // KYC readiness must match the publish gate, which checks *verified*
    // flags on merchant_verifications (not mere presence of
    // nin/bvn/cac_rc_number on the merchant row). Using the same source
    // prevents the checklist from advertising "Ready to Launch" while
    // POST /api/merchant/publish returns 400 on unverified identifiers.
    const verification = kycRequired
      ? await getVerificationFlags(validMerchant.id)
      : { nin_verified: false, bvn_verified: false, cac_verified: false };
    const hasVerifiedIdentity =
      verification.nin_verified ||
      verification.bvn_verified ||
      verification.cac_verified;

    // Build checklist items
    const items: SetupItem[] = [
      // === REQUIRED ITEMS ===
      {
        id: 'verify_kyc',
        label: 'Verify your identity (KYC)',
        description: kycRequired
          ? 'NIN, BVN, or CAC required for payments'
          : 'Required before enabling Nigerian online payouts',
        completed: kycRequired ? hasVerifiedIdentity : true,
        href: '/dashboard/settings/kyc',
        priority: kycRequired ? 'required' : 'recommended',
        category: 'payments',
      },
      {
        id: paymentRequirement.id,
        label: paymentRequirement.label,
        description: paymentRequirement.description,
        completed: paymentRequirement.completed,
        href: '/dashboard/settings/payments',
        priority: 'required',
        category: 'payments',
      },
      {
        id: 'first_product',
        label: 'Publish your first product',
        description: 'You need at least one published product to start selling',
        completed: (publishedProductCount || 0) > 0,
        href: '/dashboard/products',
        priority: 'required',
        category: 'products',
      },
      {
        id: 'country',
        label: 'Set your country/region',
        description: 'Determines currency, shipping options, and tax settings',
        completed: !!validMerchant.country,
        href: '/dashboard/settings',
        priority: 'required',
        category: 'store',
      },
      {
        id: 'contact_info',
        label: 'Add contact information',
        description: 'Let customers know how to reach you',
        completed: !!(
          validMerchant.support_email ||
          validMerchant.support_phone ||
          validMerchant.email ||
          validMerchant.phone
        ),
        href: '/dashboard/settings',
        priority: 'required',
        category: 'store',
      },

      // === RECOMMENDED ITEMS ===
      {
        id: 'about_page',
        label: 'Fill in About Us page',
        description: 'Tell your story and build trust with customers',
        completed: !!validMerchant.pages?.about,
        href: '/dashboard/pages/about',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'privacy_policy',
        label: 'Add Privacy Policy',
        description: 'Legal requirement for online stores',
        completed: !!validMerchant.pages?.privacy,
        href: '/dashboard/pages/privacy',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'terms_conditions',
        label: 'Add Terms & Conditions',
        description: 'Protect your business with clear terms',
        completed: !!validMerchant.pages?.terms,
        href: '/dashboard/pages/terms',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'business_address',
        label: 'Add business address',
        description: 'Builds trust and may be legally required',
        completed: !!validMerchant.business_address,
        href: '/dashboard/settings',
        priority: 'recommended',
        category: 'store',
      },
      // Hero carousel - now that hero_slides column exists
      {
        id: 'hero_carousel',
        label: 'Set up hero carousel',
        description: 'Add eye-catching banners to your homepage',
        completed:
          Array.isArray(validMerchant.hero_slides) &&
          validMerchant.hero_slides.length > 0,
        href: '/dashboard/settings',
        priority: 'recommended',
        category: 'marketing',
      },

      // === OPTIONAL ITEMS ===
      {
        id: 'social_media',
        label: 'Connect social media',
        description: 'Link your social profiles for better engagement',
        completed: !!(
          validMerchant.social_media?.instagram ||
          validMerchant.social_media?.facebook ||
          validMerchant.social_media?.twitter ||
          validMerchant.social_media?.tiktok
        ),
        href: '/dashboard/settings',
        priority: 'optional',
        category: 'marketing',
      },
      {
        id: 'analytics',
        label: 'Set up analytics',
        description: 'Track visitors and conversions',
        completed: !!(
          validMerchant.google_analytics_id ||
          validMerchant.facebook_pixel_id ||
          validMerchant.tiktok_pixel_id ||
          validMerchant.snapchat_pixel_id ||
          validMerchant.twitter_pixel_id
        ),
        href: '/dashboard/integrations',
        priority: 'optional',
        category: 'marketing',
      },
      {
        id: 'multiple_products',
        label: 'Add more products',
        description: 'Stores with 5+ published products convert better',
        completed: (publishedProductCount || 0) >= 5,
        href: '/dashboard/products',
        priority: 'optional',
        category: 'products',
      },
    ];

    // Calculate stats
    const requiredItems = items.filter((item) => item.priority === 'required');
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

    const readiness: StoreReadiness = {
      isReady: completedRequired === requiredItems.length,
      isPublished: validMerchant.is_published ?? false,
      completedRequired,
      totalRequired: requiredItems.length,
      completedRecommended,
      totalRecommended: recommendedItems.length,
      overallProgress: Math.round((totalCompleted / items.length) * 100),
      items,
      storeBuild,
    };

    return NextResponse.json(readiness);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    console.error('Store readiness GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
