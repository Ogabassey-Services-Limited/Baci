import { createImageUpload } from 'novel';
import { toast } from '@/hooks/use-toast';

const onUpload = (file: File) => {
  const promise = fetch('/api/merchant/blog/upload', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-vercel-filename': file.name || 'image.png',
    },
    body: file,
  });

  return new Promise((resolve, reject) => {
    toast({
      title: 'Uploading image...',
      description: 'Please wait while your image is being uploaded.',
      duration: 2000,
    });

    promise
      .then(async (res) => {
        // Successfully uploaded image
        if (res.status === 200) {
          const { url } = (await res.json()) as { url: string };
          // preload the image
          const image = new Image();
          image.src = url;
          image.onload = () => {
            resolve(url);
          };
        } else if (res.status === 401) {
          resolve(file);
          throw new Error(
            '`BLOB_READ_WRITE_TOKEN` environment variable not found, reading image locally instead.'
          );
        } else {
          throw new Error('Error uploading image. Please try again.');
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

export const uploadFn = createImageUpload({
  onUpload,
  validateFn: (file) => {
    if (!file.type.includes('image/')) {
      toast({
        title: 'Error',
        description: 'File type not supported.',
        variant: 'destructive',
      });
      return false;
    } else if (file.size / 1024 / 1024 > 20) {
      toast({
        title: 'Error',
        description: 'File size too big (max 20MB).',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  },
});
