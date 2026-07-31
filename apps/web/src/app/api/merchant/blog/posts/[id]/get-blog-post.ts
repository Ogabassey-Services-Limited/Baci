import { type NextRequest, NextResponse } from 'next/server';
import { resolveSelectedMerchantAccess } from '@/app/api/merchant/features/resolve-selected-merchant-access';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import type { RouteParams } from './route-params';

export async function getBlogPost(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const selectedMerchant = await resolveSelectedMerchantAccess({
      requestedMerchantId: request.nextUrl.searchParams.get('merchantId'),
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    if (selectedMerchant.invalidMerchantId) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }
    if (!selectedMerchant.access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = selectedMerchant.access;
    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const { data: post, error } = await auth.supabase
      .from('blog_posts')
      .select(
        'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, featured_image_width, featured_image_height, featured_image_variants, category, tags, keywords, author_name, author_title, author_image_url, author_bio, status, seo_title, seo_description, focus_keyword, word_count, reading_time_minutes, view_count, created_at, updated_at, published_at'
      )
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      console.error('Error fetching blog post:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    const { data: productLinks, error: productLinksError } = await auth.supabase
      .from('blog_post_products')
      .select('product_id')
      .eq('merchant_id', access.merchantId)
      .eq('blog_post_id', id)
      .order('created_at', { ascending: true });
    if (productLinksError) {
      console.error('Error fetching blog post product links:', {
        merchantId: access.merchantId,
        postId: id,
        error: productLinksError,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    const embeddedProducts = (productLinks ?? []).flatMap((link) =>
      typeof link.product_id === 'string' ? [link.product_id] : []
    );
    return NextResponse.json({ ...post, embedded_products: embeddedProducts });
  } catch (error) {
    console.error('Blog post GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
