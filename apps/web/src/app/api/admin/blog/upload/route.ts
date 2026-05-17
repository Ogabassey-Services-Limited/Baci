import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  BlogFeaturedImageError,
  generateFeaturedImageVariants,
} from '@/lib/blog-featured-image-variants';
import {
  buildBlogMediaCdnUrl,
  isManagedBlogStoragePath,
  PLATFORM_BLOG_MEDIA_PREFIX,
} from '@/lib/blog-managed-storage-paths';
import { revalidatePlatformBlog } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';

const PLATFORM_STORAGE_SCOPE = { kind: 'platform' } as const;
const uploadPurposeSchema = z.enum(['featured', 'inline']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const INLINE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

const FEATURED_ALLOWED_TYPES = ['image/jpeg', 'image/png'];

const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

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

function toAuthErrorResponse(status: 'unauthenticated' | 'forbidden') {
  return status === 'unauthenticated'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function getAllowedTypesForPurpose(
  purpose: z.infer<typeof uploadPurposeSchema>
) {
  return purpose === 'featured' ? FEATURED_ALLOWED_TYPES : INLINE_ALLOWED_TYPES;
}

function resolveUploadPurpose(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return 'inline' as const;
  }

  const parsed = uploadPurposeSchema.safeParse(value.toLowerCase().trim());
  return parsed.success ? parsed.data : 'inline';
}

function toPlatformMediaUrl(path: string): string {
  const url = buildBlogMediaCdnUrl(path, PLATFORM_STORAGE_SCOPE);
  if (!url) {
    throw new Error(
      `Failed to build platform blog media URL for path "${path}"`
    );
  }
  return url;
}

function buildPlatformMediaPath(pathSuffix: string): string {
  return `${PLATFORM_BLOG_MEDIA_PREFIX}/${pathSuffix}`;
}

async function cleanupUploadedPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uploadedPaths: string[]
) {
  if (uploadedPaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from('media').remove(uploadedPaths);
  if (error) {
    console.error(
      'Failed to clean up partially uploaded platform blog media paths',
      {
        error,
        uploadedPaths,
      }
    );
  }
}

function toFeaturedUploadErrorResponse(error: BlogFeaturedImageError) {
  const status = error.code === 'FEATURED_IMAGE_PROCESSING_FAILED' ? 500 : 400;
  return NextResponse.json(
    { code: error.code, error: error.message },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const supabase = await createClient();
  const isAllowed = await checkRateLimit(
    supabase,
    auth.user.id,
    'platform_blog_upload',
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
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5MB' },
      { status: 400 }
    );
  }

  const extension = mimeToExt[file.type] || 'jpg';
  const fileToken = nanoid(12);
  const filePath = buildPlatformMediaPath(`${fileToken}.${extension}`);
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const uploadedPaths: string[] = [];

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, sourceBuffer, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Platform blog media upload failed', { error: uploadError });
    return NextResponse.json(
      { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
      { status: 500 }
    );
  }

  uploadedPaths.push(filePath);

  if (purpose === 'inline') {
    revalidatePlatformBlog();
    return NextResponse.json({
      filename: `${fileToken}.${extension}`,
      path: filePath,
      size: file.size,
      type: file.type,
      url: toPlatformMediaUrl(filePath),
    });
  }

  let generated: Awaited<ReturnType<typeof generateFeaturedImageVariants>>;
  try {
    generated = await generateFeaturedImageVariants(sourceBuffer, {
      mimeType: file.type,
    });
  } catch (error) {
    await cleanupUploadedPaths(supabase, uploadedPaths);
    if (error instanceof BlogFeaturedImageError) {
      return toFeaturedUploadErrorResponse(error);
    }
    throw error;
  }

  const featuredImageVariants: Record<
    string,
    {
      contentType: string;
      height: number;
      path: string;
      url: string;
      width: number;
    }
  > = {};

  try {
    for (const variant of Object.values(generated.variants)) {
      const variantPath = buildPlatformMediaPath(
        `${fileToken}/${variant.key}.webp`
      );
      const { error: variantError } = await supabase.storage
        .from('media')
        .upload(variantPath, variant.buffer, {
          cacheControl: '31536000',
          contentType: variant.contentType,
          upsert: false,
        });

      if (variantError) {
        throw variantError;
      }

      uploadedPaths.push(variantPath);
      featuredImageVariants[variant.key] = {
        contentType: variant.contentType,
        height: variant.height,
        path: variantPath,
        url: toPlatformMediaUrl(variantPath),
        width: variant.width,
      };
    }
  } catch (error) {
    await cleanupUploadedPaths(supabase, uploadedPaths);
    console.error(
      'Platform featured variant upload failed; cleaned partial uploads',
      {
        error,
        uploadedPaths,
      }
    );
    return NextResponse.json(
      { error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
      { status: 500 }
    );
  }

  revalidatePlatformBlog();

  return NextResponse.json({
    featuredImageVariants,
    filename: `${fileToken}.${extension}`,
    height: generated.source.height,
    path: filePath,
    size: file.size,
    type: file.type,
    url: toPlatformMediaUrl(filePath),
    variantPaths: Object.fromEntries(
      Object.entries(featuredImageVariants).map(([key, value]) => [
        key,
        value.path,
      ])
    ),
    variants: Object.fromEntries(
      Object.entries(featuredImageVariants).map(([key, value]) => [
        key,
        value.url,
      ])
    ),
    width: generated.source.width,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const supabase = await createClient();
  const isAllowed = await checkRateLimit(
    supabase,
    auth.user.id,
    'platform_blog_upload',
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
    if (!isManagedBlogStoragePath(path, PLATFORM_STORAGE_SCOPE)) {
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

  const { error } = await supabase.storage.from('media').remove(dedupedPaths);
  if (error) {
    console.error('Platform blog media delete failed', {
      error,
      paths: dedupedPaths,
    });
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }

  revalidatePlatformBlog();
  return NextResponse.json({ success: true });
}
