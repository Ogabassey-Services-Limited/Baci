import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
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
    if (
      !cronSecret ||
      !expectedSecret ||
      !timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
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
      .select('id, slug, merchant_id')
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

    // 3. Batch update status to 'published'
    const postIds = scheduledPosts.map((post) => post.id);
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

    // 4. Revalidate blog caches and storefront paths for all posts
    for (const post of scheduledPosts) {
      try {
        const identifiers = await getMerchantBlogCacheIdentifiers(
          supabase,
          post.merchant_id
        );
        revalidateBlogPosts({
          identifiers,
          postSlugs: [post.slug],
        });
        console.log(`🔄 Cron: Revalidated blog cache for post ${post.slug}`);
      } catch (revalError) {
        console.warn(
          `Cron Warning: Revalidation failed for post ${post.id}:`,
          revalError
        );
      }
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
