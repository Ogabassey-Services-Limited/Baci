import { fetchWithCsrf } from '@/lib/api-client';
import {
  normalizeFeaturedImageVariantMap,
  normalizeFeaturedImageVariantPaths,
} from './new-blog-post-form-data';
import type {
  FeaturedImageVariantPaths,
  FeaturedImageVariants,
  UploadedFeaturedImage,
} from './new-blog-post-types';

interface FeaturedImageUploadResponse {
  url: string;
  path: string;
  width: number;
  height: number;
  variants?: FeaturedImageVariants;
  variantPaths?: FeaturedImageVariantPaths;
}

function parseFeaturedImageUploadResponse(
  value: unknown
): FeaturedImageUploadResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid upload response payload');
  }
  const payload = value as Record<string, unknown>;
  const { url, path, width, height } = payload;
  if (
    typeof url !== 'string' ||
    !url.trim() ||
    typeof path !== 'string' ||
    !path.trim()
  ) {
    throw new Error('Upload response is missing required image paths');
  }
  if (
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error('Upload response is missing valid image dimensions');
  }
  return {
    url,
    path,
    width,
    height,
    variants: normalizeFeaturedImageVariantMap(payload.variants),
    variantPaths: normalizeFeaturedImageVariantPaths(payload.variantPaths),
  };
}

async function deleteUploadedFeaturedImage(
  image: UploadedFeaturedImage,
  merchantId: string
): Promise<void> {
  const response = await fetchWithCsrf('/api/merchant/blog/upload', {
    headers: {
      'Content-Type': 'application/json',
      'x-baci-merchant-id': merchantId,
    },
    method: 'DELETE',
    body: JSON.stringify({
      path: image.path,
      variantPaths: image.variantPaths,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete image');
  }
}

export const newBlogPostMediaUtils = {
  deleteUploadedFeaturedImage,
  parseFeaturedImageUploadResponse,
};
