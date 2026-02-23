import { createImageUpload } from 'novel';
import { toast } from '@/hooks/use-toast';
import { uploadBlogImage } from '@/lib/blog-upload';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_BLOG_IMAGE_SIZE,
  MAX_BLOG_IMAGE_SIZE_LABEL,
} from '@/schemas/blog-upload';

const onUpload = (file: File) => {
  toast({
    title: 'Uploading image...',
    description: 'Please wait while your image is being uploaded.',
    duration: 2000,
  });

  return uploadBlogImage(file).then((result) => {
    // Preload the image before resolving
    return new Promise<string>((resolve) => {
      const image = new Image();
      image.src = result.url;
      image.onload = () => resolve(result.url);
      image.onerror = () => resolve(result.url);
    });
  });
};

export const uploadFn = createImageUpload({
  onUpload,
  validateFn: (file) => {
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
      )
    ) {
      toast({
        title: 'Error',
        description:
          'File type not supported. Use JPEG, PNG, GIF, WebP, or AVIF',
        variant: 'destructive',
      });
      return false;
    }
    if (file.size > MAX_BLOG_IMAGE_SIZE) {
      toast({
        title: 'Error',
        description: `File size too big (max ${MAX_BLOG_IMAGE_SIZE_LABEL}).`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  },
});
