import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  BlogFeaturedImageError,
  generateFeaturedImageVariants,
  isManagedBlogStoragePath,
} from '@/lib/blog-featured-image-variants';
import { buildBlogMediaCdnUrl } from '@/lib/blog-managed-storage-paths';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';

const uploadPurposeSchema = z.enum(['featured', 'inline']);

const variantPathObjectSchema = z.object({
  square_1x1: z.string().min(1).optional(),
  standard_4x3: z.string().min(1).optional(),
  landscape_16x9: z.string().min(1).optional(),
});

const deleteBodySchema = z
  .object({
    path: z.string().min(1).optional(),
    variantPaths: z
      .union([z.array(z.string().min(1)), variantPathObjectSchema])
      .optional(),
  })
  .refine(
    (value) =>
      value.path ||
      (Array.isArray(value.variantPaths)
        ? value.variantPaths.length > 0
        : Object.values(value.variantPaths ?? {}).length > 0),
    {
      message: 'No path provided',
    }
  );

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const INLINE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

const FEATURED_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

function resolveUploadPurpose(value: FormDataEntryValue | null): UploadPurpose {
  if (typeof value !== 'string') {
    return 'inline';
  }

  const parsed = uploadPurposeSchema.safeParse(value.toLowerCase().trim());
  if (!parsed.success) {
    return 'inline';
  }

  return parsed.data;
}

function getAllowedTypesForPurpose(purpose: UploadPurpose): string[] {
  return purpose === 'featured' ? FEATURED_ALLOWED_TYPES : INLINE_ALLOWED_TYPES;
}

async function cleanupUploadedPaths(
  supabase: NonNullable<
    Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
  >,
  uploadedPaths: string[]
) {
  if (uploadedPaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from('media').remove(uploadedPaths);
  if (error) {
    console.error('Failed to clean up partially uploaded blog media paths', {
      error,
      uploadedPaths,
    });
  }
}

function toFeaturedUploadErrorResponse(error: BlogFeaturedImageError) {
  const status = error.code === 'FEATURED_IMAGE_PROCESSING_FAILED' ? 500 : 400;

  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status }
  );
}

function getCanonicalBlogMediaUrl(path: string, merchantId: string): string {
  const url = buildBlogMediaCdnUrl(path, merchantId);
  if (!url) {
    console.error(
      'buildBlogMediaCdnUrl could not construct a blog media CDN URL',
      {
        path,
        merchantId,
      }
    );
    throw new Error(
      `Failed to build blog media CDN URL for merchantId="${merchantId}" path="${path}"`
    );
  }

  return url;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'marketing', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

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
    const allowedTypes = getAllowedTypesForPurpose(purpose);

    if (!allowedTypes.includes(file.type)) {
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
    const arrayBuffer = await file.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);
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
      const variantEntries = Object.values(generated.variants);
      for (const variant of variantEntries) {
        const variantPath = `${access.merchantId}/blog/${fileToken}/${variant.key}.webp`;

        const { error: variantUploadError } = await auth.supabase.storage
          .from('media')
          .upload(variantPath, variant.buffer, {
            contentType: variant.contentType,
            cacheControl: '31536000',
            upsert: false,
          });

        if (variantUploadError) {
          throw variantUploadError;
        }

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

export async function DELETE(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'marketing', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

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

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const parsed = deleteBodySchema.safeParse(requestBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    const variantPaths = Array.isArray(parsed.data.variantPaths)
      ? parsed.data.variantPaths
      : Object.values(parsed.data.variantPaths ?? {});

    const inputPaths = [parsed.data.path, ...variantPaths]
      .filter((path): path is string => typeof path === 'string')
      .map((path) => path.trim())
      .filter(Boolean);

    const dedupedPaths: string[] = [];
    const pathSet = new Set<string>();

    for (const path of inputPaths) {
      if (!isManagedBlogStoragePath(path, access.merchantId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (!pathSet.has(path)) {
        pathSet.add(path);
        dedupedPaths.push(path);
      }
    }

    if (dedupedPaths.length === 0) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    const { error: deleteError } = await auth.supabase.storage
      .from('media')
      .remove(dedupedPaths);

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
