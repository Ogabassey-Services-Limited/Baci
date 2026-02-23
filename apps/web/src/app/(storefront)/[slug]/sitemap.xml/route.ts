/**
 * Storefront sitemap route handler.
 *
 * Serves a dynamic XML sitemap for each merchant storefront. Uses proxy-set
 * headers (x-custom-domain / x-merchant-slug) to detect the merchant instead
 * of route params — this avoids the unsupported params-in-metadata-route
 * pattern and works for any TLD.
 *
 * Replaces the previous sitemap.ts metadata file which broke because
 * generateSitemaps() prevented Next.js from registering the route, letting
 * the [category] dynamic segment serve HTML instead of XML.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import type { CachedMerchant } from '@/lib/cached-data';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { generateSlug } from '@/lib/seo-utils';
import {
  buildUrlEntry,
  buildUrlsetXml,
  type UrlEntryOptions,
} from '@/lib/sitemap-xml';

// ── Supabase anon client ──
// Uses direct anon client (not the server factory from @/lib/supabase/server) because:
// 1. This route serves public data (products, categories, blog posts) — no auth needed
// 2. The server factory requires cookie context via @supabase/ssr which adds per-request overhead
// 3. Matches the pattern in api/feed/google-merchant/route.ts for public XML feeds

let _supabase: SupabaseClient | null = null;
function _getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

// ── Types ──

interface ProductRow {
  id: string;
  slug: string | null;
  category: string | null;
  images: Array<string | { url: string }> | null;
  updated_at: string | null;
  category_id: string | null;
  categories: { slug: string | null } | null;
}

interface CategoryRow {
  slug: string;
  updated_at: string | null;
}

interface BlogPostRow {
  slug: string;
  published_at: string | null;
  updated_at: string | null;
  featured_image_url: string | null;
}

// ── Helpers ──

/** Sanitize proxy header value (matches pattern in storefront orders route). */
function sanitizeHeader(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/[\n\r\t]/g, '').slice(0, 100) || null;
}

/** Detect merchant identifier from proxy-set headers. */
function resolveIdentifierFromHeaders(h: Headers): string | null {
  // Custom domain header (proxy.ts sets for ogabassey.com, ogabassey.ng, etc.)
  const customDomain = sanitizeHeader(h.get('x-custom-domain'));
  if (customDomain) return customDomain;

  // Merchant slug header (proxy.ts sets for ogabassey.usebaci.com)
  const merchantSlug = sanitizeHeader(h.get('x-merchant-slug'));
  if (merchantSlug) return merchantSlug;

  return null;
}

/** Build canonical store URL from merchant data (no TLD parsing needed). */
function buildStoreUrl(merchant: CachedMerchant): string {
  if (merchant.custom_domain) {
    return `https://${merchant.custom_domain}`;
  }
  // Schema defaults NEXT_PUBLIC_ROOT_DOMAIN to 'usebaci.com' in env.ts
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  return `https://${merchant.slug}.${rootDomain}`;
}

/** Extract valid HTTP image URLs from the product images column. */
function extractImageUrls(
  images: Array<string | { url: string }> | null
): string[] {
  if (!Array.isArray(images)) return [];
  const urls: string[] = [];
  for (const img of images) {
    const raw = typeof img === 'string' ? img : (img as { url?: string })?.url;
    if (typeof raw === 'string' && raw.startsWith('http')) {
      urls.push(raw);
    }
  }
  return urls;
}

// ── Data fetchers ──

async function fetchProducts(merchantId: string): Promise<ProductRow[] | null> {
  const { data, error } = await _getSupabase()
    .from('products')
    .select(
      'id, slug, category, images, updated_at, category_id, categories:category_id(slug)'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active');
  if (error) {
    console.error(
      '[sitemap] Failed to fetch products for %s: %s',
      merchantId,
      error.message
    );
    return null;
  }
  return (data as unknown as ProductRow[] | null) ?? [];
}

async function fetchCategories(
  merchantId: string
): Promise<CategoryRow[] | null> {
  const { data, error } = await _getSupabase()
    .from('categories')
    .select('slug, updated_at')
    .eq('merchant_id', merchantId);
  if (error) {
    console.error(
      '[sitemap] Failed to fetch categories for %s: %s',
      merchantId,
      error.message
    );
    return null;
  }
  return (data as CategoryRow[] | null) ?? [];
}

async function fetchBlogPosts(
  merchantId: string
): Promise<BlogPostRow[] | null> {
  const { data, error } = await _getSupabase()
    .from('blog_posts')
    .select('slug, published_at, updated_at, featured_image_url')
    .eq('merchant_id', merchantId)
    .eq('status', 'published');
  if (error) {
    console.error(
      '[sitemap] Failed to fetch blog posts for %s: %s',
      merchantId,
      error.message
    );
    return null;
  }
  return (data as BlogPostRow[] | null) ?? [];
}

// ── Route handler ──

export async function GET(): Promise<NextResponse> {
  try {
    const headersList = await headers();
    const identifier = resolveIdentifierFromHeaders(headersList);

    if (!identifier) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const merchant = await getMerchantByIdentifier(identifier);
    if (!merchant) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const storeUrl = buildStoreUrl(merchant);

    // Fetch all sitemap data in parallel
    const [products, categories, blogPosts] = await Promise.all([
      fetchProducts(merchant.id),
      fetchCategories(merchant.id),
      fetchBlogPosts(merchant.id),
    ]);

    // If all queries failed, return 503 so crawlers retry later
    if (products === null && categories === null && blogPosts === null) {
      return new NextResponse('Service Unavailable', { status: 503 });
    }

    const entries: string[] = [];

    // Stable timestamp for static pages — changes only when the merchant record updates
    const merchantLastmod = merchant.updated_at
      ? new Date(merchant.updated_at)
      : undefined;

    // ── Static pages ──
    entries.push(
      buildUrlEntry(storeUrl, {
        lastmod: merchantLastmod,
        changefreq: 'daily',
        priority: 1.0,
      })
    );

    // Known storefront pages — include only if merchant has content
    // (must match the notFound() conditions in each page component)
    const staticPages: Array<{ path: string; priority: number }> = [];
    // FAQ: faq/page.tsx calls notFound() when both faq_items and pages.faq are empty
    if (
      (merchant.faq_items &&
        Array.isArray(merchant.faq_items) &&
        merchant.faq_items.length > 0) ||
      merchant.pages?.faq
    ) {
      staticPages.push({ path: 'faq', priority: 0.5 });
    }
    // About: about/page.tsx calls notFound() when about_page has no story/mission AND pages.about is empty
    if (
      merchant.about_page?.story ||
      merchant.about_page?.mission ||
      merchant.pages?.about
    ) {
      staticPages.push({ path: 'about', priority: 0.5 });
    }
    if (merchant.pages) {
      if (merchant.pages.contact)
        staticPages.push({ path: 'contact', priority: 0.5 });
      if (merchant.pages.terms)
        staticPages.push({ path: 'terms', priority: 0.3 });
      if (merchant.pages.privacy)
        staticPages.push({ path: 'privacy', priority: 0.3 });
    }
    for (const page of staticPages) {
      entries.push(
        buildUrlEntry(`${storeUrl}/${page.path}`, {
          lastmod: merchantLastmod,
          changefreq: 'monthly',
          priority: page.priority,
        })
      );
    }

    // ── Category pages ──
    if (categories) {
      for (const cat of categories) {
        entries.push(
          buildUrlEntry(`${storeUrl}/${cat.slug}`, {
            lastmod: cat.updated_at
              ? new Date(cat.updated_at)
              : merchantLastmod,
            changefreq: 'daily',
            priority: 0.7,
          })
        );
      }
    }

    // ── Product pages ──
    if (products) {
      for (const product of products) {
        const productSlug = product.slug || product.id;
        const catSlug =
          product.categories?.slug ||
          (product.category ? generateSlug(product.category) : null);
        const url = catSlug
          ? `${storeUrl}/${catSlug}/${productSlug}`
          : `${storeUrl}/products/${productSlug}`;

        const images = extractImageUrls(product.images);
        const opts: UrlEntryOptions = {
          changefreq: 'weekly',
          priority: 0.8,
        };
        if (product.updated_at) opts.lastmod = new Date(product.updated_at);
        if (images.length > 0) opts.images = images;

        entries.push(buildUrlEntry(url, opts));
      }
    }

    // ── Blog pages ──
    if (blogPosts && blogPosts.length > 0) {
      entries.push(
        buildUrlEntry(`${storeUrl}/blog`, {
          lastmod: merchantLastmod,
          changefreq: 'daily',
          priority: 0.7,
        })
      );
      for (const post of blogPosts) {
        const opts: UrlEntryOptions = {
          changefreq: 'monthly',
          priority: 0.6,
        };
        if (post.updated_at) {
          opts.lastmod = new Date(post.updated_at);
        } else if (post.published_at) {
          opts.lastmod = new Date(post.published_at);
        }
        if (post.featured_image_url?.startsWith('http')) {
          opts.images = [post.featured_image_url];
        }
        entries.push(buildUrlEntry(`${storeUrl}/blog/${post.slug}`, opts));
      }
    }

    const xml = buildUrlsetXml(entries);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[sitemap] Unexpected error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
