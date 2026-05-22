import type { ReactElement } from 'react';
import {
  getMerchantBlogOgImageData,
  getMerchantBlogOgMetadataData,
  type RemoteImageLoadStatus,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';
import {
  renderGenericFallback,
  renderMerchantFallback,
  renderPrimaryCard,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-markup';
import { createBlogOgImageResponse } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-response';

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
// Keep the route response dynamic so transient image-load fallbacks can retry on the next crawler request.
export const revalidate = 0;
export const runtime = 'nodejs';

type ImageProps = { params: Promise<{ slug: string; postSlug: string }> };
type ImageResponseFallback = { element: ReactElement; noStore: boolean };

function isTransientImageStatus(status: RemoteImageLoadStatus): boolean {
  return !['source_missing', 'source_disallowed', 'loaded'].includes(status);
}

function createImageResponse(
  element: ReactElement,
  noStore = false,
  fallback?: ImageResponseFallback
) {
  return createBlogOgImageResponse(element, {
    size,
    noStore,
    fallback,
  });
}

export async function generateImageMetadata({ params }: ImageProps) {
  const { slug, postSlug } = await params;
  const data = await getMerchantBlogOgMetadataData(slug, postSlug);
  const alt = data?.post?.title
    ? `${data.post.title} — ${data.merchantBusinessName}`
    : 'Blog post';

  return [
    {
      id: 'merchant-blog-og',
      alt,
      size,
      contentType,
    },
  ];
}

export default async function Image({ params }: ImageProps) {
  let data: Awaited<ReturnType<typeof getMerchantBlogOgImageData>>;
  try {
    const { slug, postSlug } = await params;
    data = await getMerchantBlogOgImageData(slug, postSlug);
  } catch (error) {
    console.error('Failed to resolve merchant blog OG image', { error });
    return createImageResponse(renderGenericFallback('Post Not Found'), true);
  }

  if (!data) {
    return createImageResponse(renderGenericFallback('Post Not Found'), true);
  }

  if (!data.post) {
    return createImageResponse(
      renderMerchantFallback(data, 'Post Not Found'),
      false,
      {
        element: renderGenericFallback('Post Not Found'),
        noStore: true,
      }
    );
  }

  if (!data.featuredDataUri) {
    return createImageResponse(
      renderMerchantFallback(data, data.post.title || 'Blog post'),
      isTransientImageStatus(data.featuredImageStatus),
      {
        element: renderGenericFallback(data.post.title || 'Blog post'),
        noStore: true,
      }
    );
  }

  return createImageResponse(renderPrimaryCard(data), false, {
    element: renderMerchantFallback(data, data.post.title || 'Blog post'),
    noStore: true,
  });
}
