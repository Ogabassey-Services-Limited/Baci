import { type NextRequest, NextResponse } from 'next/server';
import { resolveSelectedMerchantAccess } from '@/app/api/merchant/features/resolve-selected-merchant-access';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import type { RouteParams } from './route-params';

export async function deleteBlogPost(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
    const { id } = await params;
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
    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const { data: existingPost, error: existingPostError } = await auth.supabase
      .from('blog_posts')
      .select('slug, category')
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .maybeSingle();
    if (existingPostError) {
      console.error(
        'Error fetching blog post before deletion:',
        existingPostError
      );
      return NextResponse.json(
        { error: 'Failed to load post for deletion' },
        { status: 500 }
      );
    }
    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const blogRevalidation = await getMerchantBlogRevalidationContext(
      auth.supabase,
      access.merchantId
    );
    const { error: deleteError } = await auth.supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('merchant_id', access.merchantId);
    if (deleteError) {
      console.error('Error deleting blog post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }
    revalidateBlogPosts({
      merchantId: access.merchantId,
      identifiers: blogRevalidation.identifiers,
      canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
      listingCategories: existingPost.category ? [existingPost.category] : [],
      postSlugs: existingPost.slug ? [existingPost.slug] : [],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blog post DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
