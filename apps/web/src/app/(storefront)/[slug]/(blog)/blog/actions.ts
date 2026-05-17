'use server';

import { cookies } from 'next/headers';
import { filterPublicBlogPosts } from '@/lib/public-blog-content-quality';
import { createClient } from '@/lib/supabase/server';

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

export async function fetchMorePosts(
  merchantId: string,
  page: number,
  category?: string,
  searchQuery?: string
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const limit = 12;
  const filteredPosts: BlogListPost[] = [];
  let offset = (page - 1) * limit;
  let hasMoreRows = true;

  while (hasMoreRows && filteredPosts.length < limit) {
    let query = supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, published_at, reading_time_minutes, view_count'
      )
      .eq('merchant_id', merchantId)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (searchQuery) {
      const sanitizedSearch = searchQuery.trim().slice(0, 100);
      if (sanitizedSearch) {
        query = query.textSearch('search_vector', sanitizedSearch, {
          type: 'websearch',
          config: 'english',
        });
      }
    }

    const { data: posts } = await query;
    const postBatch = Array.isArray(posts) ? (posts as BlogListPost[]) : [];
    filteredPosts.push(...filterPublicBlogPosts(postBatch));

    hasMoreRows = postBatch.length === limit;
    offset += limit;
  }

  return filteredPosts.slice(0, limit);
}
