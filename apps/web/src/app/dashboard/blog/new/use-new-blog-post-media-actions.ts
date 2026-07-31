import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMerchant } from '@/hooks/use-merchant-client';
import { fetchWithCsrf } from '@/lib/api-client';
import { newBlogPostMediaUtils } from './new-blog-post-media-utils';
import type {
  NewBlogPostFormData,
  UploadedFeaturedImage,
} from './new-blog-post-types';

type Toast = (message: {
  title: string;
  description?: string;
  variant?: 'destructive';
}) => void;

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
  const activeMerchantId = useRef(merchantId);
  const previousMerchantId = useRef(merchantId);
  const uploadedFeaturedImageRef = useRef(uploadedFeaturedImage);
  activeMerchantId.current = merchantId;
  if (uploadedFeaturedImage)
    uploadedFeaturedImageRef.current = uploadedFeaturedImage;

  useEffect(() => {
    const previousId = previousMerchantId.current;
    if (
      previousId !== merchantId &&
      previousId &&
      uploadedFeaturedImageRef.current
    ) {
      const image = uploadedFeaturedImageRef.current;
      uploadedFeaturedImageRef.current = null;
      void newBlogPostMediaUtils
        .deleteUploadedFeaturedImage(image, previousId)
        .catch((error) =>
          console.error('Error deleting tenant-switched featured image:', error)
        );
    }
    previousMerchantId.current = merchantId;
    activeMerchantId.current = merchantId;
    setIsUploading(false);
  }, [merchantId]);

  const requireMerchantId = () => {
    if (!merchantId)
      throw new Error('Select a merchant before uploading media');
    return merchantId;
  };

  const discardStaleUpload = async (
    image: UploadedFeaturedImage | null,
    uploadMerchantId: string
  ) => {
    if (activeMerchantId.current !== uploadMerchantId) {
      if (image) {
        await newBlogPostMediaUtils
          .deleteUploadedFeaturedImage(image, uploadMerchantId)
          .catch((error) =>
            console.error('Error deleting stale uploaded image:', error)
          );
      }
      throw new Error(
        'Merchant changed while uploading media. Please try again.'
      );
    }
  };

  const handleFeaturedImageUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    let uploadMerchantId: string;
    try {
      uploadMerchantId = requireMerchantId();
    } catch (error) {
      toast({
        title: 'Merchant unavailable',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return;
    }
    setIsUploading(true);
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', 'featured');
    try {
      const response = await fetchWithCsrf('/api/merchant/blog/upload', {
        headers: { 'x-baci-merchant-id': uploadMerchantId },
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }
      const data = newBlogPostMediaUtils.parseFeaturedImageUploadResponse(
        await response.json()
      );
      await discardStaleUpload(
        { path: data.path, variantPaths: data.variantPaths || {} },
        uploadMerchantId
      );
      if (uploadedFeaturedImage) {
        try {
          await newBlogPostMediaUtils.deleteUploadedFeaturedImage(
            uploadedFeaturedImage,
            uploadMerchantId
          );
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
      const nextUploadedFeaturedImage = {
        path: data.path,
        variantPaths: data.variantPaths || {},
      };
      uploadedFeaturedImageRef.current = nextUploadedFeaturedImage;
      setUploadedFeaturedImage(nextUploadedFeaturedImage);
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
      if (activeMerchantId.current === uploadMerchantId) setIsUploading(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const uploadMerchantId = requireMerchantId();
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', 'inline');
    const response = await fetchWithCsrf('/api/merchant/blog/upload', {
      headers: { 'x-baci-merchant-id': uploadMerchantId },
      method: 'POST',
      body,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }
    const data = (await response.json()) as { url?: unknown; path?: unknown };
    if (typeof data.url !== 'string' || !data.url.trim()) {
      throw new Error('Upload response is missing an image URL');
    }
    await discardStaleUpload(
      typeof data.path === 'string' && data.path.trim()
        ? { path: data.path, variantPaths: {} }
        : null,
      uploadMerchantId
    );
    return data.url;
  };

  const handleRemoveFeaturedImage = async () => {
    let selectedMerchantId: string;
    try {
      selectedMerchantId = requireMerchantId();
    } catch (error) {
      toast({
        title: 'Merchant unavailable',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return;
    }
    if (!uploadedFeaturedImage) {
      setFormData((previous) => ({
        ...previous,
        featured_image_url: '',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      }));
      uploadedFeaturedImageRef.current = null;
      setUploadedFeaturedImage(null);
      return;
    }
    try {
      await newBlogPostMediaUtils.deleteUploadedFeaturedImage(
        uploadedFeaturedImage,
        selectedMerchantId
      );
      setFormData((previous) => ({
        ...previous,
        featured_image_url: '',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      }));
      uploadedFeaturedImageRef.current = null;
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
