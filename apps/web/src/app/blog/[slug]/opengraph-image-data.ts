import { cache } from 'react';
import {
  loadFeaturedImageWithFallback,
  loadLogoImage,
  type RemoteImageLoadStatus,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';
import {
  getPlatformBlogPost,
  PLATFORM_BLOG_CONTEXT,
  type PlatformBlogPost,
} from '@/lib/platform-blog';

export type { RemoteImageLoadStatus } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';

type PlatformBlogOgPost = Pick<
  PlatformBlogPost,
  | 'author_name'
  | 'category'
  | 'featured_image_alt'
  | 'featured_image_height'
  | 'featured_image_url'
  | 'featured_image_variants'
  | 'featured_image_width'
  | 'title'
>;

export type PlatformBlogOgMetadataData = {
  businessName: string;
  post: {
    title: string | null;
  } | null;
};

export type PlatformBlogOgImageData = {
  businessName: string;
  featuredDataUri: string | null;
  featuredImageStatus: RemoteImageLoadStatus;
  logoDataUri: string | null;
  post: PlatformBlogOgPost | null;
};

function isLikelySatoriSupportedRasterUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  try {
    return !new URL(url).pathname.toLowerCase().endsWith('.webp');
  } catch {
    return !url.toLowerCase().split(/[?#]/)[0]?.endsWith('.webp');
  }
}

function getFeaturedImageSourceUrls(post: PlatformBlogOgPost): string[] {
  const urls: string[] = [];
  const rawVariants = post.featured_image_variants;
  const variants =
    rawVariants && typeof rawVariants === 'object'
      ? (rawVariants as Record<string, unknown>)
      : {};
  const landscapeVariant = variants.landscape_16x9;

  if (landscapeVariant && isLikelySatoriSupportedRasterUrl(landscapeVariant)) {
    urls.push(landscapeVariant);
  }

  if (post.featured_image_url && !urls.includes(post.featured_image_url)) {
    urls.push(post.featured_image_url);
  }

  return urls;
}

async function getPlatformBlogOgMetadataDataInternal(
  slug: string
): Promise<PlatformBlogOgMetadataData> {
  const post = await getPlatformBlogPost(slug);

  return {
    businessName: PLATFORM_BLOG_CONTEXT.businessName,
    post: post ? { title: post.title ?? null } : null,
  };
}

async function getPlatformBlogOgImageDataInternal(
  slug: string
): Promise<PlatformBlogOgImageData> {
  const post = await getPlatformBlogPost(slug);
  const logoDataUri = await loadLogoImage(PLATFORM_BLOG_CONTEXT.logoUrl);

  if (!post) {
    return {
      businessName: PLATFORM_BLOG_CONTEXT.businessName,
      post: null,
      featuredDataUri: null,
      featuredImageStatus: 'source_missing',
      logoDataUri,
    };
  }

  const featuredImage = await loadFeaturedImageWithFallback(
    getFeaturedImageSourceUrls(post),
    { kind: 'platform' }
  );

  return {
    businessName: PLATFORM_BLOG_CONTEXT.businessName,
    post: {
      author_name: post.author_name,
      category: post.category,
      featured_image_alt: post.featured_image_alt,
      featured_image_height: post.featured_image_height,
      featured_image_url: post.featured_image_url,
      featured_image_variants: post.featured_image_variants,
      featured_image_width: post.featured_image_width,
      title: post.title,
    },
    featuredDataUri: featuredImage.dataUri,
    featuredImageStatus: featuredImage.status,
    logoDataUri,
  };
}

export const getPlatformBlogOgMetadataData = cache(
  getPlatformBlogOgMetadataDataInternal
);
export const getPlatformBlogOgImageData = cache(
  getPlatformBlogOgImageDataInternal
);
