import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';

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
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Strip HTML tags for plain text excerpts using sanitize-html
// This is more reliable than regex and prevents XSS bypasses
function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
}

// Infer image MIME type from URL extension
function getImageMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  return mimeTypes[ext || ''] || 'image/jpeg';
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

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug, business_name, site_description, logo_url')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return null;
    }

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
      // Throw on posts error to return 500 (server error) instead of 404
      // Missing merchant should stay 404, but DB failures should be 500
      throw postsError;
    }

    return {
      merchant: merchant as Merchant,
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usebaci.com';
    const storeUrl = `${baseUrl}/${merchant.slug}`;
    const feedUrl = `${baseUrl}/api/blog/feed/${merchant.slug}`;

    // Build date for the channel
    const lastBuildDate =
      posts.length > 0
        ? new Date(posts[0].published_at).toUTCString()
        : new Date().toUTCString();

    // Generate RSS XML
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(merchant.business_name)} Blog</title>
    <link>${escapeXml(storeUrl)}/blog</link>
    <description>${escapeXml(merchant.site_description || `Latest posts from ${merchant.business_name}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <generator>Baci E-commerce Platform</generator>
    ${
      merchant.logo_url
        ? `<image>
      <url>${escapeXml(merchant.logo_url)}</url>
      <title>${escapeXml(merchant.business_name)}</title>
      <link>${escapeXml(storeUrl)}</link>
    </image>`
        : ''
    }
    ${posts
      .map((post) => {
        const postUrl = `${storeUrl}/blog/${post.slug}`;
        const pubDate = new Date(post.published_at).toUTCString();
        const excerpt =
          post.excerpt || stripHtml(post.content).substring(0, 300);

        // SECURITY: Sanitize HTML content to prevent XSS in RSS readers
        // Allow safe formatting tags but remove scripts, iframes, etc.
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
          // Disallow data: URIs and javascript: protocol
          allowProtocolRelative: false,
          // Add rel="noopener noreferrer" to all links for security
          transformTags: {
            a: (tagName, attribs) => ({
              tagName,
              attribs: { ...attribs, rel: 'noopener noreferrer' },
            }),
          },
        });

        return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(excerpt)}</description>
      <content:encoded><![CDATA[${sanitizedContent.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
      <dc:creator>${escapeXml(post.author_name)}</dc:creator>
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}
      ${
        post.featured_image_url
          ? `
      <enclosure url="${escapeXml(post.featured_image_url)}" type="${getImageMimeType(post.featured_image_url)}"/>
      <media:content url="${escapeXml(post.featured_image_url)}" medium="image">
        <media:title>${escapeXml(post.title)}</media:title>
      </media:content>`
          : ''
      }
    </item>`;
      })
      .join('')}
  </channel>
</rss>`;

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
