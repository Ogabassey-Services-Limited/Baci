import { cookies } from 'next/headers';
import sharp from 'sharp';
import {
  FAVICON_STORAGE_BUCKET,
  getFaviconStoragePaths,
} from '@/lib/favicon-storage-paths';
import { sanitizeSvg } from '@/lib/sanitize';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_FAVICON_TYPES = new Set([
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/webp',
]);
const MAX_FAVICON_BYTES = 1024 * 1024;

export interface FaviconUploadResult {
  svg_url?: string;
  png_32_url: string;
  png_192_url: string;
  apple_touch_url: string;
}

/**
 * Process uploaded favicon and generate all required sizes
 * Accepts SVG or PNG input, generates standardized outputs
 * @param file - File object from upload
 * @param merchantId - Merchant UUID for storage path
 * @returns URLs for all generated favicon variants
 */
export async function processFavicon(
  file: File,
  merchantId: string
): Promise<FaviconUploadResult> {
  // Validate merchantId to prevent path traversal
  if (!merchantId || !/^[a-f0-9-]{36}$/i.test(merchantId)) {
    throw new Error('Invalid merchant ID format');
  }

  if (!ALLOWED_FAVICON_TYPES.has(file.type)) {
    throw new Error('Favicon must be a PNG, JPEG, WEBP, or SVG');
  }

  if (file.size > MAX_FAVICON_BYTES) {
    throw new Error('Favicon exceeds the 1MB upload limit');
  }

  const isSvg = file.type === 'image/svg+xml';
  let buffer = Buffer.from(await file.arrayBuffer());

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const storagePaths = getFaviconStoragePaths(merchantId);

  const result: FaviconUploadResult = {
    png_32_url: '',
    png_192_url: '',
    apple_touch_url: '',
  };

  // If SVG, sanitize first, then upload and use sanitized buffer for all downstream processing
  if (isSvg) {
    // CRITICAL: Sanitize SVG to prevent XSS attacks
    const svgString = buffer.toString('utf-8');
    const sanitizedSvgString = sanitizeSvg(svgString);
    buffer = Buffer.from(sanitizedSvgString, 'utf-8');

    const { data: _svgData, error: svgError } = await supabase.storage
      .from(FAVICON_STORAGE_BUCKET)
      .upload(storagePaths.svgPath, buffer, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (svgError) throw svgError;

    const {
      data: { publicUrl: svgUrl },
    } = supabase.storage
      .from(FAVICON_STORAGE_BUCKET)
      .getPublicUrl(storagePaths.svgPath);

    result.svg_url = svgUrl;
  }

  // Generate PNG variants (uses sanitized buffer for SVG input)
  // 32x32 - Standard favicon
  const png32Buffer = await sharp(buffer)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { error: png32Error } = await supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .upload(storagePaths.png32Path, png32Buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (png32Error) throw png32Error;

  const {
    data: { publicUrl: png32Url },
  } = supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .getPublicUrl(storagePaths.png32Path);

  result.png_32_url = png32Url;

  // 192x192 - Android home screen / PWA
  const png192Buffer = await sharp(buffer)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { error: png192Error } = await supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .upload(storagePaths.png192Path, png192Buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (png192Error) throw png192Error;

  const {
    data: { publicUrl: png192Url },
  } = supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .getPublicUrl(storagePaths.png192Path);

  result.png_192_url = png192Url;

  // 180x180 - Apple Touch Icon
  const appleTouchBuffer = await sharp(buffer)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const { error: appleTouchError } = await supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .upload(storagePaths.appleTouchPath, appleTouchBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (appleTouchError) throw appleTouchError;

  const {
    data: { publicUrl: appleTouchUrl },
  } = supabase.storage
    .from(FAVICON_STORAGE_BUCKET)
    .getPublicUrl(storagePaths.appleTouchPath);

  result.apple_touch_url = appleTouchUrl;

  return result;
}

/**
 * Sanitize SVG content to remove malicious scripts
 * Uses sanitize-html allowlisting to remove active content
 * @param svgContent - Raw SVG file content
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svgContent: string): string {
  return sanitizeSvg(svgContent);
}
