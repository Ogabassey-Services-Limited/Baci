import { z } from 'zod';

/** Maximum blog image file size: 10MB */
export const MAX_BLOG_IMAGE_SIZE = 10 * 1024 * 1024;

/** Human-readable label for the max file size */
export const MAX_BLOG_IMAGE_SIZE_LABEL = '10MB';

/** Allowed MIME types for blog images */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
] as const;

/** Map validated MIME type to file extension (don't trust filenames) */
export const MIME_TO_EXT: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> =
  {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };

/** Allowed file extensions for UI display */
export const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
];

/** Schema for signed URL request metadata */
export const signedUrlRequestSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    errorMap: () => ({
      message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF',
    }),
  }),
  fileSize: z
    .number()
    .positive('File size must be positive')
    .max(
      MAX_BLOG_IMAGE_SIZE,
      `File exceeds maximum size of ${MAX_BLOG_IMAGE_SIZE_LABEL}`
    ),
});

export type SignedUrlRequest = z.infer<typeof signedUrlRequestSchema>;
