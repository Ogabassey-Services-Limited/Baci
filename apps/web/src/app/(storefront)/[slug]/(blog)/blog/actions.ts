'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function fetchMorePosts(
  merchantId: string,
  page: number,
  category?: string,
  searchQuery?: string
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const limit = 12;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, published_at, reading_time_minutes, view_count'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
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
  return posts || [];
}
