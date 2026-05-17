import { getCachedFeatureSettings, getMerchantSafe } from '@/lib/cached-data';
import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';
import {
  BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS,
  BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES,
  filterPublicBlogPosts,
  isPublicBlogPost,
} from '@/lib/public-blog-content-quality';
import { STOREFRONT_BLOG_POST_SELECT } from '@/lib/storefront-blog-post-select';
import { createPublicClient } from '@/lib/supabase/anon';

const RELATED_BLOG_POSTS_LIMIT = 3;
const RELATED_BLOG_POSTS_FETCH_LIMIT = 12;

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

  let features: Awaited<ReturnType<typeof getCachedFeatureSettings>>;
  try {
    features = await getCachedFeatureSettings(merchant.id);
  } catch {
    return null; // Treat settings fetch failure as "blog disabled"
  }
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
    query = query.eq('status', 'published').not('published_at', 'is', null);
  }

  const { data: post, error: postError } = await query.single();

  if (postError || !post) {
    if (postError && postError.code !== 'PGRST116') {
      console.error('Error fetching live blog post:', postError);
    }
    return null;
  }
  if (!includeDrafts && !isPublicBlogPost(post)) {
    return null;
  }

  let relatedQuery = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .neq('id', post.id)
    .order('published_at', { ascending: false });

  for (const blockedPrefix of BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES) {
    relatedQuery = relatedQuery.not('title', 'ilike', `${blockedPrefix}%`);
  }

  for (const blockedSlugPart of BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS) {
    relatedQuery = relatedQuery.not('slug', 'ilike', `%${blockedSlugPart}%`);
  }

  if (post.category) {
    relatedQuery = relatedQuery.eq('category', post.category);
  }

  const { data: relatedPosts, error: relatedPostsError } =
    await relatedQuery.limit(RELATED_BLOG_POSTS_FETCH_LIMIT);

  if (relatedPostsError) {
    console.error('Error fetching related live blog posts:', relatedPostsError);
  }

  const normalizedCategorySlug = normalizeStorefrontCategoryValue(
    post.category
  );
  const { data: relatedProducts, error: relatedProductsError } =
    normalizedCategorySlug
      ? await supabase
          .from('products')
          .select('id, name, slug, category_slug')
          .eq('merchant_id', merchant.id)
          .eq('status', 'active')
          .eq('category_slug', normalizedCategorySlug)
          .order('updated_at', { ascending: false })
          .limit(6)
      : { data: [], error: null };

  if (relatedProductsError) {
    console.error(
      'Error fetching related live blog products:',
      relatedProductsError
    );
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
    relatedPosts: relatedPostsError
      ? []
      : filterPublicBlogPosts(relatedPosts ?? []).slice(
          0,
          RELATED_BLOG_POSTS_LIMIT
        ),
    relatedProducts: relatedProductsError ? [] : (relatedProducts ?? []),
  };
}
