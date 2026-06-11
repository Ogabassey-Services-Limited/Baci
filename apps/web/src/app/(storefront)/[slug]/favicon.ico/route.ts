import { type NextRequest, NextResponse } from 'next/server';
import { getMerchantSafe } from '@/lib/cached-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com')
    .trim()
    .replace(/[\r\n]/g, '');
  const fallbackUrl = `https://${rootDomain}/favicon.ico`;

  try {
    const merchant = await getMerchantSafe(slug);
    if (!merchant) {
      return NextResponse.redirect(fallbackUrl, 302);
    }

    // Prioritize formats: png_32 -> svg -> apple_touch -> logo
    const candidateUrl =
      merchant.favicon_png_32_url ||
      merchant.favicon_svg_url ||
      merchant.favicon_apple_touch_url ||
      merchant.logo_url;

    if (!candidateUrl) {
      return NextResponse.redirect(fallbackUrl, 302);
    }

    // URL Safety Validation: parse the URL and ensure safe protocol (http/https only)
    try {
      const parsedUrl = new URL(candidateUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        console.warn(
          `[Favicon Router] Blocked unsafe redirect protocol: ${parsedUrl.protocol} for merchant ${slug}`
        );
        return NextResponse.redirect(fallbackUrl, 302);
      }

      const response = NextResponse.redirect(parsedUrl.toString(), 302);
      // Set short caching policy to allow merchant updates while saving DB reads
      response.headers.set(
        'Cache-Control',
        'public, max-age=300, stale-while-revalidate=600'
      );
      return response;
    } catch (urlError) {
      console.error(
        `[Favicon Router] Invalid merchant favicon URL: ${candidateUrl} for merchant ${slug}`,
        urlError
      );
      return NextResponse.redirect(fallbackUrl, 302);
    }
  } catch (err) {
    console.error(
      `[Favicon Router] Failed to resolve favicon for merchant ${slug}:`,
      err
    );
    return NextResponse.redirect(fallbackUrl, 302);
  }
}
