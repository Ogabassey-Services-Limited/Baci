'use server';

import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { getUserAccess, hasPermission } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { MIME_TO_EXT, signedUrlRequestSchema } from '@/schemas/blog-upload';

export interface SignedUploadUrlResult {
  token: string;
  path: string;
  publicUrl: string;
}

export interface ActionError {
  error: string;
}

/**
 * Server Action: Generate a signed upload URL for a blog image.
 * The client uploads directly to Supabase Storage using the returned token,
 * bypassing the server body size limit entirely.
 */
export async function getSignedUploadUrl(input: {
  contentType: string;
  fileSize: number;
}): Promise<SignedUploadUrlResult | ActionError> {
  // Auth check
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { error: 'Authentication failed' };
  }
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

  // Validate input (schema enforces contentType enum + fileSize max)
  const parsed = signedUrlRequestSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || 'Invalid input' };
  }

  // Generate secure filename from validated MIME type
  const extension = MIME_TO_EXT[parsed.data.contentType];
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
