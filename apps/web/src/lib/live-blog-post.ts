import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import {
  getCachedFeatureSettings,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

function getPublicSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'baci-web-live-blog-post',
      },
      fetch: (url, options = {}) =>
        fetch(url, {
          ...options,
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
}

export async function getLiveBlogPost(
  identifier: string,
  postSlug: string,
  includeDrafts: boolean = false
) {
  const normalizedPostSlug = postSlug?.trim().toLowerCase();
  if (!normalizedPostSlug) {
    return null;
  }

  const lookupKey = identifier.toLowerCase();
  const merchant =
    lookupKey.includes('.') && !lookupKey.includes('/')
      ? await getCachedMerchantByDomain(lookupKey)
      : await getCachedMerchant(lookupKey);

  if (!merchant) return null;

  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, content, featured_image_url, featured_image_alt, category, tags, author_name, author_avatar, author_title, author_bio, published_at, status, meta_title, meta_description, seo_title, seo_description, keywords, reading_time_minutes, word_count, view_count, created_at, updated_at'
    )
    .eq('merchant_id', merchant.id)
    .eq('slug', normalizedPostSlug);

  if (!includeDrafts) {
    query = query.eq('status', 'published');
  }

  const { data: post, error: postError } = await query.single();

  if (postError || !post) {
    if (postError && postError.code !== 'PGRST116') {
      console.error('Error fetching live blog post:', postError);
    }
    return null;
  }

  let relatedQuery = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(3);

  if (post.category) {
    relatedQuery = relatedQuery.eq('category', post.category);
  }

  const { data: relatedPosts, error: relatedPostsError } = await relatedQuery;

  if (relatedPostsError) {
    console.error('Error fetching related live blog posts:', relatedPostsError);
  }

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
    },
    post,
    relatedPosts: relatedPostsError ? [] : (relatedPosts ?? []),
  };
}
