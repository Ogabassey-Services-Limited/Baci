import { getCachedFeatureSettings, getMerchantSafe } from '@/lib/cached-data';
import { STOREFRONT_BLOG_POST_SELECT } from '@/lib/storefront-blog-post-select';
import { createPublicClient } from '@/lib/supabase/anon';

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
  const merchant = await getMerchantSafe(lookupKey);

  if (!merchant) return null;

  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = createPublicClient({
    clientInfo: 'baci-web-live-blog-post',
    timeoutMs: 10000,
  });

  let query = supabase
    .from('blog_posts')
    .select(STOREFRONT_BLOG_POST_SELECT)
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
      custom_domain: merchant.custom_domain,
    },
    post,
    relatedPosts: relatedPostsError ? [] : (relatedPosts ?? []),
  };
}
