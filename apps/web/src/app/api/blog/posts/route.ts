import { type NextRequest, NextResponse } from 'next/server';
import {
  getPlatformBlogListing,
  getPlatformBlogPost,
  incrementPlatformBlogPostViews,
} from '@/lib/platform-blog';

function parseSafeLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '20', 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

function parseSafeOffset(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const slug = searchParams.get('slug')?.trim().toLowerCase();
    const trackView = searchParams.get('trackView') === '1';
    const tag = searchParams.get('tag');

    if (slug) {
      const post = await getPlatformBlogPost(slug);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (trackView) {
        try {
          await incrementPlatformBlogPostViews(post.id);
          return NextResponse.json({ ok: true });
        } catch (error) {
          // Preserve read availability even if analytics increments fail.
          console.error('Failed to increment platform blog post views:', {
            error,
            postId: post.id,
          });
          return NextResponse.json({ ok: false });
        }
      }

      return NextResponse.json(post);
    }

    const limit = parseSafeLimit(searchParams.get('limit'));
    const offset = parseSafeOffset(searchParams.get('offset'));
    const listing = await getPlatformBlogListing({
      category,
      limit,
      offset,
      tag,
    });

    return NextResponse.json({
      hasMore: listing.hasMore,
      limit: listing.limit,
      offset,
      page: listing.page,
      posts: listing.posts,
      total: listing.total,
      totalPages: listing.totalPages,
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    );
  }
}
