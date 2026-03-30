import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { getMerchantBlogCacheIdentifiers } from '@/lib/get-merchant-blog-cache-identifiers';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/cron/publish-scheduled-posts
 *
 * Vercel Cron job to publish scheduled blog posts.
 * Runs every 5 minutes.
 *
 * Security: Requires x-cron-secret header
 */
export async function POST(request: Request) {
  try {
    // 1. Security Check - use constant-time comparison to prevent timing attacks
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!cronSecret || !expectedSecret) {
      console.warn('Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronSecretBuf = Buffer.from(cronSecret);
    const expectedSecretBuf = Buffer.from(expectedSecret);

    if (
      cronSecretBuf.length !== expectedSecretBuf.length ||
      !timingSafeEqual(cronSecretBuf, expectedSecretBuf)
    ) {
      console.warn('Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    console.log(`🚀 Cron: Checking for scheduled posts to publish at ${now}`);

    // 2. Identify eligible posts
    // Posts where status is 'scheduled' and published_at is in the past
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, slug, merchant_id, category')
      .eq('status', 'scheduled')
      .lte('published_at', now);

    if (fetchError) {
      console.error('Cron Error: Failed to fetch scheduled posts:', fetchError);
      return NextResponse.json(
        { error: 'Database fetch failed' },
        { status: 500 }
      );
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts to publish',
      });
    }

    console.log(`📦 Cron: Found ${scheduledPosts.length} posts to publish`);

    const postIds = scheduledPosts.map((post) => post.id);
    const merchantIds = Array.from(
      new Set(scheduledPosts.map((post) => post.merchant_id))
    );

    // 3. Group scheduled posts by merchant and compute listing sizes before mutating
    const postsByMerchant = new Map<
      string,
      {
        categories: Set<string>;
        listingPages: number[];
        postSlugs: string[];
      }
    >();

    for (const post of scheduledPosts) {
      const merchantPosts = postsByMerchant.get(post.merchant_id) ?? {
        categories: new Set<string>(),
        listingPages: [1],
        postSlugs: [],
      };

      if (post.slug) {
        merchantPosts.postSlugs.push(post.slug);
      }

      if (post.category) {
        merchantPosts.categories.add(post.category);
      }

      postsByMerchant.set(post.merchant_id, merchantPosts);
    }

    const publishedPostCountsByMerchant = new Map<string, number>();
    const { data: publishedPosts, error: publishedPostsError } = await supabase
      .from('blog_posts')
      .select('merchant_id')
      .eq('status', 'published')
      .in('merchant_id', merchantIds);

    if (publishedPostsError) {
      console.error(
        'Cron Error: Failed to load published blog counts for revalidation:',
        publishedPostsError
      );
      return NextResponse.json(
        { error: 'Failed to load published blog counts' },
        { status: 500 }
      );
    }

    for (const post of publishedPosts ?? []) {
      publishedPostCountsByMerchant.set(
        post.merchant_id,
        (publishedPostCountsByMerchant.get(post.merchant_id) ?? 0) + 1
      );
    }

    for (const [merchantId, merchantPosts] of postsByMerchant) {
      const publishedPostCount =
        (publishedPostCountsByMerchant.get(merchantId) ?? 0) +
        merchantPosts.postSlugs.length;
      const totalPages = Math.max(
        1,
        Math.ceil(publishedPostCount / BLOG_LISTING_PAGE_SIZE)
      );

      merchantPosts.listingPages = Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    // 4. Batch update status to 'published'
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ status: 'published' })
      .in('id', postIds);

    if (updateError) {
      console.error('Cron Error: Batch update failed:', updateError);
      return NextResponse.json(
        { error: 'Batch update failed' },
        { status: 500 }
      );
    }

    // 5. Revalidate blog caches grouped by merchant
    const failedMerchants: string[] = [];

    for (const [merchantId, merchantPosts] of postsByMerchant) {
      try {
        const identifiers = await getMerchantBlogCacheIdentifiers(
          supabase,
          merchantId
        );
        revalidateBlogPosts({
          identifiers,
          listingCategories: Array.from(merchantPosts.categories),
          listingPages: merchantPosts.listingPages,
          postSlugs: merchantPosts.postSlugs,
        });
        console.log(
          `🔄 Cron: Revalidated blog cache for merchant ${merchantId} across ${merchantPosts.postSlugs.length} posts`
        );
      } catch (revalError) {
        console.error(
          'Cron Error: Revalidation failed for merchant %s:',
          merchantId,
          revalError
        );
        failedMerchants.push(merchantId);
      }
    }

    if (failedMerchants.length > 0) {
      return NextResponse.json(
        {
          error: 'Failed to revalidate blog caches for some merchants',
          failedMerchants,
          processed: scheduledPosts.length,
          published: postIds,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: scheduledPosts.length,
      published: postIds,
    });
  } catch (error) {
    console.error('Cron Job Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support GET for local development testing
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Use cron secret from env or a fallback for dev
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || 'dev-secret',
    },
  });

  return await POST(mockRequest);
}
