import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

const deleteBodySchema = z.object({
  path: z.string().min(1, 'No path provided'),
});

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    // Default user client
    const userSupabase = createClient(cookieStore);

    let supabaseClient = userSupabase;
    let merchant: { id: string; slug: string } | null = null;

    // Check authentication
    const auth = await authenticateApiRequest(request);
    const user = auth.user;

    if (!user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Authenticated User Flow (supports both owners and staff members)
    const authedSupabase = auth.supabase;
    const access = await getUserAccess(authedSupabase);
    if (access) {
      supabaseClient = authedSupabase;
      if (!hasPermission(access, 'marketing', 'edit')) {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }

      // Fetch merchant slug if needed
      const { data: merchantData } = await supabaseClient
        .from('merchants')
        .select('slug')
        .eq('id', access.merchantId)
        .single();

      merchant = {
        id: access.merchantId,
        slug: merchantData?.slug || '',
      };
    }

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const entry = formData.get('file');
    if (!entry || !(entry instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const file = entry;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Map validated MIME type to extension (don't trust filename)
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
    };
    const extension = mimeToExt[file.type] || 'jpg';
    const filename = `${nanoid(12)}.${extension}`;

    // Path: merchant_id/blog/filename (merchant ID first for storage policy)
    const filePath = `${merchant.id}/blog/${filename}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage (using appropriate client)
    const { error: uploadError } = await supabaseClient.storage
      .from('media')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
        { status: 500 }
      );
    }

    // Get public URL (getPublicUrl is a static URL builder that works with any client)
    const { data: publicUrlData } = supabaseClient.storage
      .from('media')
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: filePath,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Error uploading blog image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', code: 'UPLOAD_EXCEPTION' },
      { status: 500 }
    );
  }
}

// Delete image
export async function DELETE(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check authentication
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get access (supports both owners and staff members)
    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchant = { id: access.merchantId };

    const parsed = deleteBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }
    const { path } = parsed.data;

    // Ensure the path belongs to this merchant and prevent path traversal
    const expectedPrefix = `${merchant.id}/blog/`;
    // Reject paths with traversal sequences or that don't match expected format
    if (
      typeof path !== 'string' ||
      path.includes('..') ||
      path.includes('//') ||
      !path.startsWith(expectedPrefix) ||
      path.split('/').length !== 3
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('media')
      .remove([path]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
