import { cache } from 'react';
import {
  loadFeaturedImage,
  loadLogoImage,
  type RemoteImageLoadStatus,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';
import { withTimeout } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-security';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import {
  getCachedFeatureSettings,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { createPublicClient } from '@/lib/supabase/public';
import { isDomainIdentifier } from '@/lib/validation';

const MERCHANT_LOOKUP_TIMEOUT_MS = 4000;
const FEATURE_SETTINGS_TIMEOUT_MS = 4000;

export type {
  RemoteImageLoadResult,
  RemoteImageLoadStatus,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';
export { loadRemoteImageDataUri } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';
export { isAllowedBlogOgImageUrl } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-security';
export { getBlogCacheTag } from '@/lib/blog-cache-tags';

type MerchantBrandColors = {
  background: string | null;
  primary: string | null;
  accent: string | null;
};

type MerchantBlogOgPost = {
  title: string | null;
  category: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: Partial<
    Record<'landscape_16x9' | 'standard_4x3' | 'square_1x1', string>
  >;
};

export type MerchantBlogOgMetadataData = {
  merchantBusinessName: string;
  post: {
    title: string | null;
  } | null;
};

export type MerchantBlogOgImageData = {
  merchantBusinessName: string;
  merchantBrandColors: MerchantBrandColors;
  post: MerchantBlogOgPost | null;
  featuredDataUri: string | null;
  featuredImageStatus: RemoteImageLoadStatus;
  logoDataUri: string | null;
};

type ResolvedMerchant = Awaited<ReturnType<typeof getCachedMerchant>>;

function getMerchantBrandColors(merchant: NonNullable<ResolvedMerchant>) {
  const rawColors =
    merchant.brand_colors && typeof merchant.brand_colors === 'object'
      ? (merchant.brand_colors as Partial<
          Record<keyof MerchantBrandColors, unknown>
        >)
      : {};

  return {
    background:
      typeof rawColors.background === 'string' ? rawColors.background : null,
    primary: typeof rawColors.primary === 'string' ? rawColors.primary : null,
    accent: typeof rawColors.accent === 'string' ? rawColors.accent : null,
  };
}

async function resolveMerchantForBlogOg(
  slug: string,
  postSlug: string
): Promise<{
  merchant: NonNullable<ResolvedMerchant>;
  merchantBusinessName: string;
  merchantBrandColors: MerchantBrandColors;
} | null> {
  let merchant: ResolvedMerchant;

  try {
    merchant = await withTimeout(
      isDomainIdentifier(slug)
        ? getCachedMerchantByDomain(slug)
        : getCachedMerchant(slug),
      MERCHANT_LOOKUP_TIMEOUT_MS,
      'blog merchant lookup'
    );
  } catch (error) {
    console.error('Failed to fetch merchant for blog OG image', {
      routeIdentifier: slug,
      postSlug,
      error,
    });
    return null;
  }

  if (!merchant) return null;

  const merchantBusinessName = merchant.business_name?.trim();
  if (!merchantBusinessName) return null;

  try {
    const features = await withTimeout(
      getCachedFeatureSettings(merchant.id),
      FEATURE_SETTINGS_TIMEOUT_MS,
      'blog feature settings lookup'
    );
    if (!features?.blog_enabled) return null;
  } catch (error) {
    console.error('Failed to fetch blog feature settings for OG image', {
      merchantId: merchant.id,
      routeIdentifier: slug,
      postSlug,
      error,
    });
    return null;
  }

  return {
    merchant,
    merchantBusinessName,
    merchantBrandColors: getMerchantBrandColors(merchant),
  };
}

function getPublicBlogClient() {
  return createPublicClient({
    clientInfo: 'baci-web-merchant-blog-og-image',
    timeoutMs: 4000,
  });
}

function isLikelySatoriSupportedRasterUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    return !new URL(url).pathname.toLowerCase().endsWith('.webp');
  } catch {
    return !url.toLowerCase().split(/[?#]/)[0]?.endsWith('.webp');
  }
}

function getFeaturedImageSourceUrl(post: MerchantBlogOgPost): string | null {
  const landscapeVariant = post.featured_image_variants?.landscape_16x9;
  if (isLikelySatoriSupportedRasterUrl(landscapeVariant)) {
    return landscapeVariant ?? null;
  }
  return post.featured_image_url;
}

async function getPostForImage(
  merchantId: string,
  postSlug: string
): Promise<MerchantBlogOgPost | null | 'error'> {
  const supabase = getPublicBlogClient();
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select(
      'title, category, featured_image_url, featured_image_alt, author_name, featured_image_width, featured_image_height, featured_image_variants'
    )
    .eq('merchant_id', merchantId)
    .eq('slug', postSlug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch blog post for OG image', {
      merchantId,
      postSlug,
      error,
    });
    return 'error';
  }

  return post as MerchantBlogOgPost | null;
}

async function getPostForMetadata(
  merchantId: string,
  postSlug: string
): Promise<{ title: string | null } | null | 'error'> {
  const supabase = getPublicBlogClient();
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('title')
    .eq('merchant_id', merchantId)
    .eq('slug', postSlug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch blog post metadata for OG image', {
      merchantId,
      postSlug,
      error,
    });
    return 'error';
  }

  return post ? { title: post.title ?? null } : null;
}

async function getMerchantBlogOgMetadataDataInternal(
  slug: string,
  postSlug: string
): Promise<MerchantBlogOgMetadataData | null> {
  const resolved = await resolveMerchantForBlogOg(slug, postSlug);
  if (!resolved) return null;

  const post = await getPostForMetadata(resolved.merchant.id, postSlug);
  if (post === 'error') return null;

  return {
    merchantBusinessName: resolved.merchantBusinessName,
    post,
  };
}

async function getMerchantBlogOgImageDataInternal(
  slug: string,
  postSlug: string
): Promise<MerchantBlogOgImageData | null> {
  const resolved = await resolveMerchantForBlogOg(slug, postSlug);
  if (!resolved) return null;

  const blogCacheTag = getBlogCacheTag(slug, postSlug);
  const post = await getPostForImage(resolved.merchant.id, postSlug);
  if (post === 'error') return null;

  if (!post) {
    const logoDataUri = await loadLogoImage(
      resolved.merchant.logo_url,
      blogCacheTag
    );
    return {
      merchantBusinessName: resolved.merchantBusinessName,
      merchantBrandColors: resolved.merchantBrandColors,
      post: null,
      featuredDataUri: null,
      featuredImageStatus: 'source_missing',
      logoDataUri,
    };
  }

  const featuredSourceUrl = getFeaturedImageSourceUrl(post);
  const [featuredImage, logoDataUri] = await Promise.all([
    loadFeaturedImage(featuredSourceUrl, resolved.merchant.id, blogCacheTag),
    loadLogoImage(resolved.merchant.logo_url, blogCacheTag),
  ]);

  return {
    merchantBusinessName: resolved.merchantBusinessName,
    merchantBrandColors: resolved.merchantBrandColors,
    post,
    featuredDataUri: featuredImage.dataUri,
    featuredImageStatus: featuredImage.status,
    logoDataUri,
  };
}

export const getMerchantBlogOgMetadataData = cache(
  getMerchantBlogOgMetadataDataInternal
);

export const getMerchantBlogOgImageData = cache(
  getMerchantBlogOgImageDataInternal
);
