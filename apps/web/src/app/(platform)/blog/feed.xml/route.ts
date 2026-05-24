import { Feed } from 'feed';
import { type NextRequest, NextResponse } from 'next/server';
import { stripHtml } from '@/lib/blog-utils';
import {
  getPlatformBlogFeedPosts,
  PLATFORM_BLOG_CONTEXT,
} from '@/lib/platform-blog';
import { sanitizeForFeed } from '@/lib/sanitize';

function parseValidDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(_request: NextRequest) {
  try {
    const posts = await getPlatformBlogFeedPosts();
    const feedUrl = `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog/feed.xml`;
    const blogUrl = `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog`;

    const validPosts = posts.flatMap((post) => {
      const publishedDate = parseValidDate(post.published_at);
      return publishedDate ? [{ post, publishedDate }] : [];
    });

    const feed = new Feed({
      title: `${PLATFORM_BLOG_CONTEXT.businessName} Blog`,
      description:
        'Insights, updates, and practical playbooks for modern African merchants.',
      id: blogUrl,
      link: blogUrl,
      language: 'en',
      image: PLATFORM_BLOG_CONTEXT.logoUrl,
      favicon: `${PLATFORM_BLOG_CONTEXT.baseUrl}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}, ${PLATFORM_BLOG_CONTEXT.businessName}`,
      generator: 'Baci Platform Blog',
      ...(validPosts[0]
        ? {
            updated: validPosts[0].publishedDate,
          }
        : {}),
      feedLinks: {
        rss2: feedUrl,
      },
      author: {
        name: PLATFORM_BLOG_CONTEXT.businessName,
        link: PLATFORM_BLOG_CONTEXT.baseUrl,
      },
    });

    for (const { post, publishedDate } of validPosts) {
      const excerpt =
        post.excerpt || stripHtml(post.content || '').substring(0, 300);
      feed.addItem({
        title: post.title,
        id: `${blogUrl}/${post.slug}`,
        link: `${blogUrl}/${post.slug}`,
        description: excerpt,
        content: sanitizeForFeed(post.content || ''),
        author: [
          {
            name: post.author_name || PLATFORM_BLOG_CONTEXT.businessName,
            link: PLATFORM_BLOG_CONTEXT.baseUrl,
          },
        ],
        date: publishedDate,
        image: post.featured_image_url || undefined,
        category: post.category ? [{ name: post.category }] : undefined,
      });
    }

    return new NextResponse(feed.rss2(), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Platform RSS feed error:', error);
    return new NextResponse('Error generating feed', { status: 500 });
  }
}
