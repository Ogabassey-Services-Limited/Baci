import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Bulk Publish Products API
 *
 * POST - Delete draft products and publish all remaining products
 */

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Delete draft products
    const { data: deletedDrafts, error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('merchant_id', merchant.id)
      .eq('status', 'draft')
      .select('id');

    if (deleteError) {
      console.error('Error deleting drafts:', deleteError);
    }

    // Update all remaining products to active (valid statuses: draft, active, archived)
    const { data: updatedProducts, error: updateError } = await supabase
      .from('products')
      .update({ status: 'active', is_active: true })
      .eq('merchant_id', merchant.id)
      .neq('status', 'active')
      .select('id');

    if (updateError) {
      console.error('Error publishing products:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish products' },
        { status: 500 }
      );
    }

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
