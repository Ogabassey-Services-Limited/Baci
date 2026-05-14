import { NextResponse } from 'next/server';
import { validateBlogDiscoverImageReadiness } from '@/lib/blog-discover-readiness';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/cron/publish-scheduled-posts
 *
 * Manual fallback only - DO NOT re-enable Vercel Cron for this route.
 * Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
 *
 * Security: Requires x-cron-secret header
 */
export async function POST(request: Request) {
  try {
    // 1. Security Check - use constant-time comparison to prevent timing attacks
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (
      !cronSecret ||
      !expectedSecret ||
      !constantTimeEqual(cronSecret, expectedSecret)
    ) {
      console.warn('Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    console.log(`🚀 Cron: Checking for scheduled posts to publish at ${now}`);

    // 2. Identify scheduled posts
    // Posts where status is 'scheduled' and published_at is in the past
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('blog_posts')
      .select(
        'id, slug, merchant_id, category, featured_image_url, featured_image_width, featured_image_height, featured_image_variants'
      )
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

    const scheduledMerchantIds = Array.from(
      new Set(scheduledPosts.map((post) => post.merchant_id))
    );
    const { data: featureSettings, error: featureSettingsError } =
      await supabase
        .from('merchant_feature_settings')
        .select('merchant_id, blog_discover_image_validation_enabled')
        .in('merchant_id', scheduledMerchantIds);

    if (featureSettingsError) {
      console.error(
        'Cron Error: Failed to load blog Discover validation flags:',
        featureSettingsError
      );
      return NextResponse.json(
        { error: 'Failed to load blog feature settings' },
        { status: 500 }
      );
    }

    const validationEnabledByMerchant = new Map(
      (featureSettings ?? []).map(
        (settings: {
          merchant_id: string;
          blog_discover_image_validation_enabled?: boolean | null;
        }) => [
          settings.merchant_id,
          settings.blog_discover_image_validation_enabled === true,
        ]
      )
    );
    const eligiblePosts: typeof scheduledPosts = [];
    const skipped: Array<{
      id: string;
      slug: string | null;
      code: string;
      details: Record<string, unknown>;
    }> = [];
    const warnings: Array<{
      id: string;
      slug: string | null;
      code: string;
      details: Record<string, unknown>;
    }> = [];

    for (const post of scheduledPosts) {
      const readiness = validateBlogDiscoverImageReadiness(
        post,
        post.merchant_id
      );

      if (!readiness.ready) {
        const warning = {
          id: post.id,
          slug: post.slug,
          code: readiness.code,
          details: readiness.details,
        };

        if (validationEnabledByMerchant.get(post.merchant_id) === true) {
          skipped.push(warning);
          continue;
        }

        warnings.push(warning);
        console.warn(
          'Cron Warning: Scheduled blog post is not Discover image ready',
          warning
        );
      }

      eligiblePosts.push(post);
    }

    if (eligiblePosts.length === 0) {
      return NextResponse.json({
        success: true,
        processed: scheduledPosts.length,
        published: [],
        skipped,
        warnings,
      });
    }

    const postIds = eligiblePosts.map((post) => post.id);
    const merchantIds = Array.from(
      new Set(eligiblePosts.map((post) => post.merchant_id))
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

    for (const post of eligiblePosts) {
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
        const blogRevalidation = await getMerchantBlogRevalidationContext(
          supabase,
          merchantId
        );
        revalidateBlogPosts({
          identifiers: blogRevalidation.identifiers,
          canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
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
      skipped,
      warnings,
    });
  } catch (error) {
    console.error('Cron Job Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support GET for manual fallback invocation.
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !authHeader ||
    !constantTimeEqual(authHeader, `Bearer ${secret}`)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'x-cron-secret': secret },
  });

  return await POST(mockRequest);
}
