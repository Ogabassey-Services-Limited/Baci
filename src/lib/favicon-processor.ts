import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import DOMPurify from 'isomorphic-dompurify';

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
    const isSvg = file.type === 'image/svg+xml';
    const buffer = Buffer.from(await file.arrayBuffer());

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const result: FaviconUploadResult = {
        png_32_url: '',
        png_192_url: '',
        apple_touch_url: '',
    };

    // If SVG, upload as-is and also convert to PNG sizes
    if (isSvg) {
        const svgPath = `${merchantId}/icon.svg`;
        const { data: svgData, error: svgError } = await supabase.storage
            .from('favicons')
            .upload(svgPath, buffer, {
                contentType: 'image/svg+xml',
                upsert: true,
            });

        if (svgError) throw svgError;

        const { data: { publicUrl: svgUrl } } = supabase.storage
            .from('favicons')
            .getPublicUrl(svgPath);

        result.svg_url = svgUrl;
    }

    // Generate PNG variants
    // 32x32 - Standard favicon
    const png32Buffer = await sharp(buffer)
        .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const png32Path = `${merchantId}/icon-32.png`;
    const { error: png32Error } = await supabase.storage
        .from('favicons')
        .upload(png32Path, png32Buffer, {
            contentType: 'image/png',
            upsert: true,
        });

    if (png32Error) throw png32Error;

    const { data: { publicUrl: png32Url } } = supabase.storage
        .from('favicons')
        .getPublicUrl(png32Path);

    result.png_32_url = png32Url;

    // 192x192 - Android home screen / PWA
    const png192Buffer = await sharp(buffer)
        .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const png192Path = `${merchantId}/icon-192.png`;
    const { error: png192Error } = await supabase.storage
        .from('favicons')
        .upload(png192Path, png192Buffer, {
            contentType: 'image/png',
            upsert: true,
        });

    if (png192Error) throw png192Error;

    const { data: { publicUrl: png192Url } } = supabase.storage
        .from('favicons')
        .getPublicUrl(png192Path);

    result.png_192_url = png192Url;

    // 180x180 - Apple Touch Icon
    const appleTouchBuffer = await sharp(buffer)
        .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const appleTouchPath = `${merchantId}/apple-touch-icon.png`;
    const { error: appleTouchError } = await supabase.storage
        .from('favicons')
        .upload(appleTouchPath, appleTouchBuffer, {
            contentType: 'image/png',
            upsert: true,
        });

    if (appleTouchError) throw appleTouchError;

    const { data: { publicUrl: appleTouchUrl } } = supabase.storage
        .from('favicons')
        .getPublicUrl(appleTouchPath);

    result.apple_touch_url = appleTouchUrl;

    return result;
}

/**
 * Sanitize SVG content to remove malicious scripts
 * Uses DOMPurify with SVG profile for comprehensive security
 * @param svgContent - Raw SVG file content
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svgContent: string): string {
    return DOMPurify.sanitize(svgContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'polygon', 'line', 'polyline', 'ellipse', 'g', 'defs', 'use', 'symbol', 'linearGradient', 'radialGradient', 'stop'],
        ADD_ATTR: ['viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'rx', 'ry', 'transform', 'id', 'class', 'style'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
}
