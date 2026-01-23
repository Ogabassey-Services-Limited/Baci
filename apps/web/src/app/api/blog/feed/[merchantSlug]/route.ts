import { createClient } from '@supabase/supabase-js';
import { Feed } from 'feed';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';
import { getAppUrl } from '@/env';

/**
 * Blog RSS Feed API
 *
 * Generates an RSS 2.0 feed for a merchant's published blog posts.
 * This is critical for:
 * - Google Discover eligibility
 * - Feed readers
 * - Content syndication
 * - SEO crawlers
 *
 * @see https://www.rssboard.org/rss-specification
 */

interface RouteParams {
  params: Promise<{ merchantSlug: string }>;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string | null;
  category: string | null;
  author_name: string;
  published_at: string;
  updated_at: string;
}

interface Merchant {
  id: string;
  slug: string;
  business_name: string;
  site_description: string | null;
  logo_url: string | null;
  custom_domain?: string | null;
}

// Strip HTML tags for plain text excerpts using sanitize-html
function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
}

// Create anonymous Supabase client for public access
function getPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

// Cache RSS feed for 1 hour
const getCachedFeed = unstable_cache(
  async (merchantSlug: string) => {
    const supabase = getPublicClient();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Get merchant with custom domain in a single query
    const { data: merchantData, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id,
        slug,
        business_name,
        site_description,
        logo_url,
        domains!left(domain, is_primary, status)
      `)
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchantData) {
      return null;
    }

    // Extract primary active domain from joined data
    const domains = merchantData.domains as Array<{
      domain: string;
      is_primary: boolean;
      status: string;
    }> | null;
    const primaryDomain = domains?.find(
      (d) => d.is_primary && d.status === 'active'
    );

    const merchant: Merchant = {
      id: merchantData.id,
      slug: merchantData.slug,
      business_name: merchantData.business_name,
      site_description: merchantData.site_description,
      logo_url: merchantData.logo_url,
      custom_domain: primaryDomain?.domain || null,
    };

    // Get published blog posts
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, content, excerpt, featured_image_url, category, author_name, published_at, updated_at'
      )
      .eq('merchant_id', merchant.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50);

    if (postsError) {
      console.error('Error fetching blog posts for feed:', postsError);
      throw postsError;
    }

    return {
      merchant,
      posts: (posts || []) as BlogPost[],
    };
  },
  ['blog-rss-feed'],
  {
    revalidate: 3600, // 1 hour
    tags: ['blog-posts'],
  }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantSlug } = await params;

    const data = await getCachedFeed(merchantSlug);

    if (!data) {
      return new NextResponse('Blog feed not found', { status: 404 });
    }

    const { merchant, posts } = data;

    // Base URL for the merchant's storefront
    // Use custom domain if available, otherwise fall back to slug-based URL
    const baseUrl = getAppUrl();
    const storeUrl = merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `${baseUrl}/${merchant.slug}`;
    const feedUrl = `${baseUrl}/api/blog/feed/${merchant.slug}`;

    // Build date for the channel
    const lastBuildDate =
      posts.length > 0 ? new Date(posts[0].published_at) : new Date();

    const feed = new Feed({
      title: `${merchant.business_name} Blog`,
      description:
        merchant.site_description ||
        `Latest posts from ${merchant.business_name}`,
      id: `${storeUrl}/blog`,
      link: `${storeUrl}/blog`,
      language: 'en',
      image: merchant.logo_url || undefined,
      favicon: `${baseUrl}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}, ${merchant.business_name}`,
      updated: lastBuildDate,
      generator: 'Baci E-commerce Platform',
      feedLinks: {
        rss2: feedUrl,
      },
      author: {
        name: merchant.business_name,
        link: storeUrl,
      },
    });

    for (const post of posts) {
      const postUrl = `${storeUrl}/blog/${post.slug}`;
      const excerpt = post.excerpt || stripHtml(post.content).substring(0, 300);

      // SECURITY: Sanitize HTML content to prevent XSS in RSS readers
      const sanitizedContent = sanitizeHtml(post.content, {
        allowedTags: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'pre',
          'code',
          'a',
          'img',
        ],
        allowedAttributes: {
          a: ['href', 'title', 'rel'],
          img: ['src', 'alt', 'title', 'width', 'height'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowProtocolRelative: false,
        transformTags: {
          a: (tagName, attribs) => ({
            tagName,
            attribs: { ...attribs, rel: 'noopener noreferrer' },
          }),
        },
      });

      feed.addItem({
        title: post.title,
        id: postUrl,
        link: postUrl,
        description: excerpt,
        content: sanitizedContent,
        author: [
          {
            name: post.author_name,
            link: storeUrl,
          },
        ],
        date: new Date(post.published_at),
        image: post.featured_image_url || undefined,
        category: post.category ? [{ name: post.category }] : undefined,
      });
    }

    const rss = feed.rss2();

    return new NextResponse(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('RSS feed error:', error);
    return new NextResponse('Error generating feed', { status: 500 });
  }
}
