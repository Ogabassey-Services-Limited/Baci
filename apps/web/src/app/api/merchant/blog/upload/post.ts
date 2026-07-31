import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import {
  BlogFeaturedImageError,
  generateFeaturedImageVariants,
} from '@/lib/blog-featured-image-variants';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  cleanupUploadedPaths,
  getAllowedTypesForPurpose,
  getCanonicalBlogMediaUrl,
  MAX_FILE_SIZE,
  mimeToExt,
  resolveMerchantAccess,
  resolveUploadPurpose,
  toFeaturedUploadErrorResponse,
} from './upload-route-utils';

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  const merchantAccess = await resolveMerchantAccess({
    headers: request.headers,
    supabase: auth.supabase,
    userId: auth.user.id,
  });
  if (merchantAccess.response || !merchantAccess.access) {
    return (
      merchantAccess.response ??
      NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
    );
  }
  const access = merchantAccess.access;

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    const isAllowed = await checkRateLimit(
      auth.supabase,
      auth.user.id,
      'merchant_blog_upload',
      5,
      1
    );
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'rate_limited' },
        { status: 429 }
      );
    }
    const formData = await request.formData();
    const entry = formData.get('file');
    if (!entry || !(entry instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const file = entry;
    const purpose = resolveUploadPurpose(formData.get('purpose'));
    if (!getAllowedTypesForPurpose(purpose).includes(file.type)) {
      return NextResponse.json(
        {
          error:
            purpose === 'featured'
              ? 'Invalid file type. Featured images must be JPEG, PNG, WebP, or AVIF.'
              : 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF',
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    const extension = mimeToExt[file.type] || 'jpg';
    const fileToken = nanoid(12);
    const filename = `${fileToken}.${extension}`;
    const filePath = `${access.merchantId}/blog/${filename}`;
    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    const uploadedPaths: string[] = [];
    if (purpose === 'inline') {
      const { error: uploadError } = await auth.supabase.storage
        .from('media')
        .upload(filePath, sourceBuffer, {
          contentType: file.type,
          cacheControl: '31536000',
          upsert: false,
        });
      if (uploadError) {
        console.error('Inline blog media upload failed', {
          merchantId: access.merchantId,
          error: uploadError,
          purpose,
          type: file.type,
          size: file.size,
        });
        return NextResponse.json(
          { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        url: getCanonicalBlogMediaUrl(filePath, access.merchantId),
        path: filePath,
        filename,
        size: file.size,
        type: file.type,
      });
    }

    let generated: Awaited<ReturnType<typeof generateFeaturedImageVariants>>;
    try {
      generated = await generateFeaturedImageVariants(sourceBuffer, {
        mimeType: file.type,
      });
    } catch (error) {
      if (error instanceof BlogFeaturedImageError) {
        return toFeaturedUploadErrorResponse(error);
      }
      throw error;
    }
    const { error: originalUploadError } = await auth.supabase.storage
      .from('media')
      .upload(filePath, sourceBuffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });
    if (originalUploadError) {
      console.error('Featured original upload failed', {
        merchantId: access.merchantId,
        error: originalUploadError,
        purpose,
        type: file.type,
        size: file.size,
      });
      return NextResponse.json(
        { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
        { status: 500 }
      );
    }
    uploadedPaths.push(filePath);

    const featuredImageVariants: Record<
      string,
      {
        url: string;
        path: string;
        width: number;
        height: number;
        contentType: string;
      }
    > = {};
    try {
      for (const variant of Object.values(generated.variants)) {
        const variantPath = `${access.merchantId}/blog/${fileToken}/${variant.key}.webp`;
        const { error: variantUploadError } = await auth.supabase.storage
          .from('media')
          .upload(variantPath, variant.buffer, {
            contentType: variant.contentType,
            cacheControl: '31536000',
            upsert: false,
          });
        if (variantUploadError) throw variantUploadError;
        uploadedPaths.push(variantPath);
        featuredImageVariants[variant.key] = {
          url: getCanonicalBlogMediaUrl(variantPath, access.merchantId),
          path: variantPath,
          width: variant.width,
          height: variant.height,
          contentType: variant.contentType,
        };
      }
    } catch (error) {
      await cleanupUploadedPaths(auth.supabase, uploadedPaths);
      console.error('Featured variant upload failed; cleaned partial uploads', {
        merchantId: access.merchantId,
        error,
        uploadedPaths,
      });
      return NextResponse.json(
        { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
        { status: 500 }
      );
    }

    console.info('Processed featured blog media upload', {
      merchantId: access.merchantId,
      purpose,
      sourceWidth: generated.source.width,
      sourceHeight: generated.source.height,
      sourceTotalPixels: generated.source.totalPixels,
      variantKeys: Object.keys(featuredImageVariants),
      size: file.size,
      type: file.type,
    });
    const variants = Object.fromEntries(
      Object.entries(featuredImageVariants).map(([key, value]) => [
        key,
        value.url,
      ])
    );
    const variantPaths = Object.fromEntries(
      Object.entries(featuredImageVariants).map(([key, value]) => [
        key,
        value.path,
      ])
    );
    return NextResponse.json({
      url: getCanonicalBlogMediaUrl(filePath, access.merchantId),
      path: filePath,
      filename,
      size: file.size,
      type: file.type,
      width: generated.source.width,
      height: generated.source.height,
      variants,
      variantPaths,
      featuredImageVariants,
    });
  } catch (error) {
    console.error('Error uploading blog image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', code: 'UPLOAD_EXCEPTION' },
      { status: 500 }
    );
  }
}
