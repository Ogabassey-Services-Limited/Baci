import { createImageUpload } from 'novel';
import { toast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

export function createMerchantImageUpload(merchantId: string) {
  return (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'inline');

    const promise = fetchWithCsrf('/api/merchant/blog/upload', {
      headers: { 'x-baci-merchant-id': merchantId },
      method: 'POST',
      body: formData,
    });

    return new Promise((resolve, reject) => {
      toast({
        title: 'Uploading image...',
        description: 'Please wait while your image is being uploaded.',
        duration: 2000,
      });

      promise
        .then(async (res) => {
          if (res.status === 200) {
            const { url } = (await res.json()) as { url: string };
            resolve(url);
          } else if (res.status === 401) {
            throw new Error('Image upload unauthorized');
          } else {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              data.error || 'Error uploading image. Please try again.'
            );
          }
        })
        .catch((error) => {
          toast({
            title: 'Error uploading image',
            description: error.message,
            variant: 'destructive',
          });
          reject(error);
        });
    });
  };
}

export const validateFn = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast({
      title: 'Error',
      description: 'File type not supported.',
      variant: 'destructive',
    });
    return false;
  }
  if (file.size / 1024 / 1024 > 20) {
    toast({
      title: 'Error',
      description: 'File size too big (max 20MB).',
      variant: 'destructive',
    });
    return false;
  }

  return true;
};

export function createImageUploader(
  onUpload: ReturnType<typeof createMerchantImageUpload>
) {
  return createImageUpload({ onUpload, validateFn });
}

export function createMerchantImageUploader(merchantId: string) {
  return createImageUploader(createMerchantImageUpload(merchantId));
}
