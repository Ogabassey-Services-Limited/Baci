import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get merchant with all relevant fields (only columns that exist in the table)
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id,
        business_name,
        country,
        logo_url,
        support_email,
        support_phone,
        business_address,
        paystack_subaccount_code,
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
        is_published,
        nin,
        bvn,
        cac_rc_number
      `)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      console.error('[Readiness API] Merchant lookup failed:', {
        userId: user.id,
        error: merchantError,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { count: publishedProductCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    // Build checklist items
    const items: SetupItem[] = [
      // === REQUIRED ITEMS ===
      {
        id: 'verify_kyc',
        label: 'Verify your identity (KYC)',
        description: 'NIN, BVN, or CAC required for payments',
        completed: !!(merchant.nin || merchant.bvn || merchant.cac_rc_number),
        href: '/dashboard/settings/kyc',
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
        completed: !!merchant.country,
        href: '/dashboard/settings',
        priority: 'required',
        category: 'store',
      },
      {
        id: 'contact_info',
        label: 'Add contact information',
        description: 'Let customers know how to reach you',
        completed: !!(merchant.support_email || merchant.support_phone),
        href: '/dashboard/settings',
        priority: 'required',
        category: 'store',
      },

      // === RECOMMENDED ITEMS ===
      {
        id: 'about_page',
        label: 'Fill in About Us page',
        description: 'Tell your story and build trust with customers',
        completed: !!merchant.pages?.about,
        href: '/dashboard/pages/about',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'privacy_policy',
        label: 'Add Privacy Policy',
        description: 'Legal requirement for online stores',
        completed: !!merchant.pages?.privacy,
        href: '/dashboard/pages/privacy',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'terms_conditions',
        label: 'Add Terms & Conditions',
        description: 'Protect your business with clear terms',
        completed: !!merchant.pages?.terms,
        href: '/dashboard/pages/terms',
        priority: 'recommended',
        category: 'legal',
      },
      {
        id: 'business_address',
        label: 'Add business address',
        description: 'Builds trust and may be legally required',
        completed: !!merchant.business_address,
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
          Array.isArray(merchant.hero_slides) &&
          merchant.hero_slides.length > 0,
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
          merchant.social_media?.instagram ||
          merchant.social_media?.facebook ||
          merchant.social_media?.twitter ||
          merchant.social_media?.tiktok
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
          merchant.google_analytics_id ||
          merchant.facebook_pixel_id ||
          merchant.tiktok_pixel_id ||
          merchant.snapchat_pixel_id ||
          merchant.twitter_pixel_id
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
      isPublished: merchant.is_published ?? false,
      completedRequired,
      totalRequired: requiredItems.length,
      completedRecommended,
      totalRecommended: recommendedItems.length,
      overallProgress: Math.round((totalCompleted / items.length) * 100),
      items,
    };

    return NextResponse.json(readiness);
  } catch (error) {
    console.error('Store readiness GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
