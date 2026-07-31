import { type NextRequest, NextResponse } from 'next/server';
import { resolveSelectedMerchantAccess } from '@/app/api/merchant/features/resolve-selected-merchant-access';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';

export async function listBlogPosts(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc';
    const blogPostColumns =
      'id, title, slug, excerpt, featured_image_url, featured_image_width, featured_image_height, featured_image_variants, category, status, author_name, view_count, reading_time_minutes, created_at, updated_at, published_at';
    let query = auth.supabase
      .from('blog_posts')
      .select(blogPostColumns, { count: 'exact' })
      .eq('merchant_id', access.merchantId);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (search) {
      const sanitized = search.trim().slice(0, 100);
      if (sanitized) {
        query = query.textSearch('search_vector', sanitized, {
          type: 'websearch',
          config: 'english',
        });
      }
    }
    query = query
      .order(sortBy, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    const [
      { data: posts, error: postsError, count },
      { count: totalCount },
      { count: publishedCount },
      { count: draftCount },
      { count: archivedCount },
    ] = await Promise.all([
      query,
      auth.supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId),
      auth.supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'published'),
      auth.supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'draft'),
      auth.supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'archived'),
    ]);
    if (postsError) {
      console.error('Error fetching blog posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
      counts: {
        total: totalCount || 0,
        published: publishedCount || 0,
        draft: draftCount || 0,
        archived: archivedCount || 0,
      },
    });
  } catch (error) {
    console.error('Blog posts GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
