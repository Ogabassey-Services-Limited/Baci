'use client';

import { getSignedUploadUrl } from '@/actions/blog-upload';
import { createClient } from '@/lib/supabase/client';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_BLOG_IMAGE_SIZE,
  MAX_BLOG_IMAGE_SIZE_LABEL,
} from '@/schemas/blog-upload';

export interface BlogImageUploadResult {
  url: string;
  path: string;
}

/**
 * Upload a blog image using signed URLs (2026 best practice).
 *
 * Flow:
 * 1. Validate file type and size client-side
 * 2. Call Server Action to get a signed upload token
 * 3. Upload directly to Supabase Storage (bypasses server body limit)
 *
 * @throws Error with user-friendly message on failure
 */
export async function uploadBlogImage(
  file: File
): Promise<BlogImageUploadResult> {
  // Client-side validation
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    throw new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF');
  }

  if (file.size > MAX_BLOG_IMAGE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${MAX_BLOG_IMAGE_SIZE_LABEL}`
    );
  }

  // Step 1: Get signed upload URL from server
  const result = await getSignedUploadUrl({
    filename: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  if ('error' in result) {
    throw new Error(result.error);
  }

  // Step 2: Upload directly to Supabase Storage
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from('media')
    .uploadToSignedUrl(result.path, result.token, file, {
      contentType: file.type,
      cacheControl: '31536000', // 1 year cache
    });

  if (uploadError) {
    console.error('uploadToSignedUrl error:', uploadError);
    throw new Error('Failed to upload image. Please try again.');
  }

  return {
    url: result.publicUrl,
    path: result.path,
  };
}
