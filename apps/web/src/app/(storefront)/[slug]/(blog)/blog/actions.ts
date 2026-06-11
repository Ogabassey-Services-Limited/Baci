'use server';

import { cookies } from 'next/headers';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import { createClient } from '@/lib/supabase/server';
import { fetchMorePostsInputSchema } from '@/schemas/storefront-blog-actions';

interface BlogListPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  tags: string[] | null;
  author_name: string | null;
  published_at: string;
  reading_time_minutes: number | null;
  view_count: number | null;
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: anonymous blog pagination of published posts; Zod-validated, merchant-scoped + identity/IP rate limited
export async function fetchMorePosts(
  merchantId: string,
  page: number,
  category?: string,
  searchQuery?: string
): Promise<BlogListPost[]> {
  // Public read by design (anonymous storefront pagination) — rate limiting
  // is the abuse control here, not a login gate.
  const allowed = await ensureActionRateLimit('storefront-blog-list', {
    requests: 60,
    windowMs: 60_000,
  });
  if (!allowed) {
    return [];
  }

  const parsed = fetchMorePostsInputSchema.safeParse({
    merchantId,
    page,
    category,
    searchQuery,
  });
  if (!parsed.success) {
    throw new Error('Invalid blog post request');
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const limit = 12;
  const offset = (parsed.data.page - 1) * limit;
  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, published_at, reading_time_minutes, view_count'
    )
    .eq('merchant_id', parsed.data.merchantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .order('published_at', { ascending: false });

  query = applyPublicBlogSqlFilters(query);

  if (parsed.data.category) {
    query = query.eq('category', parsed.data.category);
  }

  if (parsed.data.searchQuery) {
    const sanitizedSearch = parsed.data.searchQuery.trim().slice(0, 100);
    if (sanitizedSearch) {
      query = query.textSearch('search_vector', sanitizedSearch, {
        type: 'websearch',
        config: 'english',
      });
    }
  }

  const { data: posts, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error('Failed to fetch more blog posts', {
      merchantId,
      page,
      error,
    });
    throw error;
  }

  return Array.isArray(posts) ? (posts as BlogListPost[]) : [];
}
