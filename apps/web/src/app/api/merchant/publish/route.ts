import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { revalidateMerchant } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/admin';

interface MerchantVerificationStatus {
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
 * KYC gaps and block already-verified merchants from publishing.
 */
async function getVerificationStatus(
  merchantId: string
): Promise<MerchantVerificationStatus> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchant_verifications')
    .select('nin_verified, bvn_verified, cac_verified')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('[Publish API] merchant_verifications read failed:', error);
    throw new Error('Failed to load verification status');
  }

  return {
    nin_verified: !!data?.nin_verified,
    bvn_verified: !!data?.bvn_verified,
    cac_verified: !!data?.cac_verified,
  };
}

/**
 * Store Publish API
 *
 * POST - Publish the merchant's store (make it publicly accessible)
 * DELETE - Unpublish the store (take it offline)
 */

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Use the auth-scoped client from authenticateApiRequest for all DB ops so
    // mobile (Bearer token) requests run with the user's token and satisfy
    // RLS. Falling back to cookie-based createClient would run as anon on
    // React Native where no session cookie is present, silently failing RLS
    // checks and breaking publish from the mobile admin app.
    const supabase = auth.supabase;

    // Get merchant with required fields for validation
    const { data: merchant } = await supabase
      .from('merchants')
      .select(
        'id, business_name, country, support_email, support_phone, paystack_subaccount_code, bank_code, bank_account_number'
      )
      .eq('id', access.merchantId)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Check for required setup items
    const missingItems: string[] = [];

    // Identity verification requires at least one of NIN/BVN/CAC to have been
    // *verified* against the upstream identity provider — not merely entered.
    // merchant_verifications is the source of truth for verified flags.
    const verification = await getVerificationStatus(merchant.id);
    const hasVerifiedIdentity =
      verification.nin_verified ||
      verification.bvn_verified ||
      verification.cac_verified;
    if (!hasVerifiedIdentity) {
      missingItems.push('Identity verification (NIN, BVN, or CAC)');
    }

    // Bank account required for payments
    if (
      !merchant.bank_code ||
      !merchant.bank_account_number ||
      !merchant.paystack_subaccount_code
    ) {
      missingItems.push('Bank account details');
    }

    // Country required for currency/shipping
    if (!merchant.country) {
      missingItems.push('Country/region setting');
    }

    // Contact info required
    if (!merchant.support_email && !merchant.support_phone) {
      missingItems.push('Contact information (email or phone)');
    }

    // Check for at least one product
    const { count: productCount, error: productError } = await supabase
      .from('products')
      // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    // Also get total products for debugging
    const { count: totalProducts, error: totalProductsError } = await supabase
      .from('products')
      // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id);

    console.log('[Publish API] Product check:', {
      merchantId: merchant.id,
      activeCount: productCount,
      totalProducts,
      productError,
      totalProductsError,
    });

    if (!productCount || productCount === 0) {
      missingItems.push(
        totalProducts && totalProducts > 0
          ? `At least one active product (you have ${totalProducts} product(s) but none are active - go to Products and activate them)`
          : 'At least one active product'
      );
    }

    // If any required items are missing, return error
    if (missingItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot publish store',
          message: 'Please complete the following required items:',
          missingItems,
        },
        { status: 400 }
      );
    }

    // All checks passed, publish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error publishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish store' },
        { status: 500 }
      );
    }

    // Invalidate merchant caches so the store becomes visible immediately
    revalidateMerchant(merchant.id);

    return NextResponse.json({
      success: true,
      message: 'Store published successfully',
    });
  } catch (error) {
    console.error('Store publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Use the auth-scoped client from authenticateApiRequest so mobile
    // (Bearer token) requests satisfy RLS. See POST handler for context.
    const supabase = auth.supabase;

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', access.merchantId)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Unpublish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: false,
      })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error unpublishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to unpublish store' },
        { status: 500 }
      );
    }

    // Invalidate merchant caches so the store goes offline immediately
    revalidateMerchant(merchant.id);

    return NextResponse.json({
      success: true,
      message: 'Store unpublished successfully',
    });
  } catch (error) {
    console.error('Store unpublish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
