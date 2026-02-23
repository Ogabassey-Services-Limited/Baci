'use server';

import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { getUserAccess, hasPermission } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_BLOG_IMAGE_SIZE,
  MAX_BLOG_IMAGE_SIZE_LABEL,
  MIME_TO_EXT,
  signedUrlRequestSchema,
} from '@/schemas/blog-upload';

interface SignedUploadUrlResult {
  token: string;
  path: string;
  publicUrl: string;
}

interface ActionError {
  error: string;
}

/**
 * Server Action: Generate a signed upload URL for a blog image.
 * The client uploads directly to Supabase Storage using the returned token,
 * bypassing the server body size limit entirely.
 */
export async function getSignedUploadUrl(input: {
  filename: string;
  contentType: string;
  fileSize: number;
}): Promise<SignedUploadUrlResult | ActionError> {
  // Auth check
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  // Permission check
  const access = await getUserAccess(supabase);
  if (!access) {
    return { error: 'Merchant not found' };
  }
  if (!hasPermission(access, 'marketing', 'edit')) {
    return { error: 'Permission denied' };
  }

  // Validate input
  const parsed = signedUrlRequestSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || 'Invalid input' };
  }

  // Validate MIME type is in our allowlist
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      parsed.data.contentType as (typeof ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    return { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF' };
  }

  // Validate file size
  if (parsed.data.fileSize > MAX_BLOG_IMAGE_SIZE) {
    return {
      error: `File exceeds maximum size of ${MAX_BLOG_IMAGE_SIZE_LABEL}`,
    };
  }

  // Generate secure filename from validated MIME type
  const extension = MIME_TO_EXT[parsed.data.contentType] || 'jpg';
  const filename = `${nanoid(12)}.${extension}`;
  const filePath = `${access.merchantId}/blog/${filename}`;

  // Create signed upload URL
  const { data, error } = await supabase.storage
    .from('media')
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    console.error('createSignedUploadUrl error:', error);
    return { error: 'Failed to generate upload URL' };
  }

  // Build public URL
  const { data: publicUrlData } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);

  return {
    token: data.token,
    path: filePath,
    publicUrl: publicUrlData.publicUrl,
  };
}
