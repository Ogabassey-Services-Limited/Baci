import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

import { createAdminClient } from '@/lib/supabase/admin';

// ... existing imports ...

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Default user client
    const userSupabase = createClient(cookieStore);

    let supabaseClient = userSupabase;
    let merchant: { id: string; slug: string } | null = null;

    // Check authentication
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    // Check for Dev Mode Override
    const devMerchantId = request.headers.get('x-dev-merchant-id');
    const DEV_MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
    const isDevOverride = !user && devMerchantId === DEV_MERCHANT_ID;

    if (!user && !isDevOverride) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isDevOverride) {
      // Use Admin Client for Dev Mode to bypass RLS
      const adminSupabase = createAdminClient();
      const { data } = await adminSupabase
        .from('merchants')
        .select('id, slug')
        .eq('id', DEV_MERCHANT_ID)
        .single();
      merchant = data;
      supabaseClient = adminSupabase;
    } else {
      // Authenticated User Flow
      const { data } = await userSupabase
        .from('merchants')
        .select('id, slug')
        // biome-ignore lint/style/noNonNullAssertion: Checked by authentication logic
        .eq('user_id', user!.id)
        .single();
      merchant = data;
    }

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

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

    // NOTE: Path matches Mobile App expectations
    const filePath = `blog/${merchant.id}/${filename}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage (using appropriate client)
    const { error: uploadError } = await supabaseClient.storage
      .from('merchant-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL using Admin Client to ensure visibility if bucket is private
    // (though getPublicUrl is usually static string manipulation, it's safer to use the client that knows the bucket)
    const { data: publicUrlData } = supabaseClient.storage
      .from('merchant-assets')
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
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// Delete image
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    // Ensure the path belongs to this merchant and prevent path traversal
    const expectedPrefix = `blog/${merchant.id}/`;
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
      .from('merchant-assets')
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
