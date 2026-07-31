import { type Dispatch, type SetStateAction, useState } from 'react';
import { useMerchant } from '@/hooks/use-merchant-client';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  normalizeFeaturedImageVariantMap,
  normalizeFeaturedImageVariantPaths,
} from './new-blog-post-form-data';
import type {
  FeaturedImageVariantPaths,
  FeaturedImageVariants,
  NewBlogPostFormData,
  UploadedFeaturedImage,
} from './new-blog-post-types';

type Toast = (message: {
  title: string;
  description?: string;
  variant?: 'destructive';
}) => void;

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
  merchantId?: string
): Promise<void> {
  const response = await fetchWithCsrf('/api/merchant/blog/upload', {
    headers: {
      'Content-Type': 'application/json',
      ...(merchantId ? { 'x-baci-merchant-id': merchantId } : {}),
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

export function useNewBlogPostMediaActions({
  uploadedFeaturedImage,
  setFormData,
  setUploadedFeaturedImage,
  toast,
}: {
  uploadedFeaturedImage: UploadedFeaturedImage | null;
  setFormData: Dispatch<SetStateAction<NewBlogPostFormData>>;
  setUploadedFeaturedImage: Dispatch<
    SetStateAction<UploadedFeaturedImage | null>
  >;
  toast: Toast;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  const handleFeaturedImageUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsUploading(true);
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', 'featured');
    try {
      const response = await fetchWithCsrf('/api/merchant/blog/upload', {
        headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }
      const data = parseFeaturedImageUploadResponse(await response.json());
      if (uploadedFeaturedImage) {
        try {
          await deleteUploadedFeaturedImage(uploadedFeaturedImage, merchantId);
        } catch (error) {
          console.error(
            'Error deleting previously uploaded featured image:',
            error
          );
        }
      }
      setFormData((previous) => ({
        ...previous,
        featured_image_url: data.url,
        featured_image_width: data.width,
        featured_image_height: data.height,
        featured_image_variants: data.variants || {},
      }));
      setUploadedFeaturedImage({
        path: data.path,
        variantPaths: data.variantPaths || {},
      });
      toast({
        title: 'Success',
        description: 'Featured image uploaded successfully.',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', 'inline');
    const response = await fetchWithCsrf('/api/merchant/blog/upload', {
      headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
      method: 'POST',
      body,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }
    const data = await response.json();
    return data.url;
  };

  const handleRemoveFeaturedImage = async () => {
    if (!uploadedFeaturedImage) {
      setFormData((previous) => ({
        ...previous,
        featured_image_url: '',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      }));
      setUploadedFeaturedImage(null);
      return;
    }
    try {
      await deleteUploadedFeaturedImage(uploadedFeaturedImage, merchantId);
      setFormData((previous) => ({
        ...previous,
        featured_image_url: '',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      }));
      setUploadedFeaturedImage(null);
    } catch (error) {
      console.error('Error deleting uploaded image:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  return {
    handleFeaturedImageUpload,
    handleImageUpload,
    handleRemoveFeaturedImage,
    isUploading,
  };
}
