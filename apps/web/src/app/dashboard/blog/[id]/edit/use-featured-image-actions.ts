import { useRef, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  BLOG_FEATURED_VARIANT_KEYS,
  extractManagedBlogStoragePath,
} from '@/lib/blog-managed-storage-paths';
import {
  normalizeFeaturedImageVariantMap,
  normalizeFeaturedImageVariantPaths,
} from './edit-blog-form-data';
import type {
  FeaturedImageVariantPaths,
  PostFormData,
  UploadedFeaturedImage,
} from './edit-blog-types';

type Toast = (message: {
  title: string;
  description?: string;
  variant?: 'destructive';
}) => void;

async function errorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = await response.text();
    if (!body) return fallback;
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim())
        return parsed.error;
      if (typeof parsed.message === 'string' && parsed.message.trim())
        return parsed.message;
    } catch {
      return body;
    }
    return body;
  } catch {
    return fallback;
  }
}

async function deleteImage(
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
    const fallback = 'Failed to delete image';
    const message = await errorMessage(response, fallback);
    throw new Error(
      message === fallback
        ? `${fallback} (${response.status})`
        : `${fallback} (${response.status}): ${message}`
    );
  }
}

async function uploadImage(
  file: File,
  purpose: 'featured' | 'inline',
  merchantId?: string
) {
  const body = new FormData();
  body.append('file', file);
  body.append('purpose', purpose);
  const response = await fetchWithCsrf('/api/merchant/blog/upload', {
    headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
    method: 'POST',
    body,
  });
  if (!response.ok)
    throw new Error(
      ((await response.json()) as { error?: string }).error ||
        'Failed to upload image'
    );
  return (await response.json()) as {
    url: string;
    path: string;
    width: number;
    height: number;
    variants?: unknown;
    variantPaths?: unknown;
  };
}

export function useFeaturedImageActions({
  merchantId,
  formData,
  setFormData,
  toast,
}: {
  merchantId?: string;
  formData: PostFormData;
  setFormData: React.Dispatch<React.SetStateAction<PostFormData>>;
  toast: Toast;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const uploadedImage = useRef<UploadedFeaturedImage | null>(null);

  const handleFeaturedImageUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await uploadImage(file, 'featured', merchantId);
      if (uploadedImage.current) {
        try {
          await deleteImage(uploadedImage.current, merchantId);
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
        featured_image_variants: normalizeFeaturedImageVariantMap(
          data.variants
        ),
      }));
      uploadedImage.current = {
        path: data.path,
        variantPaths: normalizeFeaturedImageVariantPaths(data.variantPaths),
      };
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

  const handleInlineImageUpload = async (file: File) =>
    (await uploadImage(file, 'inline', merchantId)).url;

  const handleRemoveFeaturedImage = async () => {
    let image = uploadedImage.current;
    if (!image && merchantId && formData.featured_image_url) {
      const path = extractManagedBlogStoragePath(
        formData.featured_image_url,
        merchantId
      );
      if (path) {
        const variantPaths: FeaturedImageVariantPaths = {};
        for (const key of BLOG_FEATURED_VARIANT_KEYS) {
          const url = formData.featured_image_variants[key];
          const variantPath =
            url && extractManagedBlogStoragePath(url, merchantId);
          if (variantPath) variantPaths[key] = variantPath;
        }
        image = { path, variantPaths };
      }
    }
    try {
      if (image) await deleteImage(image, merchantId);
      setFormData((previous) => ({
        ...previous,
        featured_image_url: '',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      }));
      uploadedImage.current = null;
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
    handleInlineImageUpload,
    handleRemoveFeaturedImage,
    isUploading,
  };
}
