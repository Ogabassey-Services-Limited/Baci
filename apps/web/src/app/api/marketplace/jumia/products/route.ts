import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json(
      { error: 'Product ID is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get product to verify ownership
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('merchant_id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get Jumia mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('jumia_product_mappings')
      .select(
        'id, product_id, jumia_sku, jumia_product_url, sync_status, last_synced_at, created_at'
      )
      .eq('product_id', productId)
      .single();

    if (mappingError && mappingError.code !== 'PGRST116') {
      console.error('Error fetching Jumia mapping:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({ mapping: mapping || null });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
