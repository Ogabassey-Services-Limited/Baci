import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { revalidateMerchant } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant with required fields for validation
    const { data: merchant } = await supabase
      .from('merchants')
      .select(`
	        id,
	        business_name,
	        country,
	        support_email,
	        support_phone,
	        nin,
	        bvn,
	        cac_rc_number,
	        paystack_subaccount_code,
	        bank_code,
	        bank_account_number
	      `)
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

    if (!merchant.nin && !merchant.bvn && !merchant.cac_rc_number) {
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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
