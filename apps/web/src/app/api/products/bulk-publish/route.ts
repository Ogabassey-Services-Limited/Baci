import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Bulk Publish Products API
 *
 * POST - Delete draft products and publish all remaining products
 */

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Delete draft products
    const { data: deletedDrafts, error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('merchant_id', merchantId)
      .eq('status', 'draft')
      .select('id');

    if (deleteError) {
      console.error('Error deleting drafts:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete draft products' },
        { status: 500 }
      );
    }

    // Update all remaining products to active (valid statuses: draft, active, archived)
    const { data: updatedProducts, error: updateError } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('merchant_id', merchantId)
      .neq('status', 'active')
      .select('id');

    if (updateError) {
      console.error('Error publishing products:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish products' },
        { status: 500 }
      );
    }

    // Invalidate product caches after bulk publish
    revalidateProducts(merchantId);

    return NextResponse.json({
      success: true,
      deletedDrafts: deletedDrafts?.length || 0,
      publishedProducts: updatedProducts?.length || 0,
    });
  } catch (error) {
    console.error('Bulk publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
