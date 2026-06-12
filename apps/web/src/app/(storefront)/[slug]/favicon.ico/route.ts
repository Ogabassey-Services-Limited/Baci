import { type NextRequest, NextResponse } from 'next/server';
import { getMerchantSafe } from '@/lib/cached-data';

function buildRedirectResponse(url: string, status = 302): NextResponse {
  const response = NextResponse.redirect(url, status);
  // Set caching policy to allow merchant updates while saving DB/routing reads
  response.headers.set(
    'Cache-Control',
    'public, max-age=300, stale-while-revalidate=600'
  );
  return response;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com')
    .trim()
    .replace(/[\r\n]/g, '');

  const protocol = _request.nextUrl?.protocol || 'https:';
  const fallbackUrl = `${protocol}//${rootDomain}/favicon.ico`;

  try {
    const merchant = await getMerchantSafe(slug);
    if (!merchant) {
      return buildRedirectResponse(fallbackUrl);
    }

    const requestUrl = new URL(_request.url);
    const candidates = [
      merchant.favicon_png_32_url,
      merchant.favicon_svg_url,
      merchant.favicon_apple_touch_url,
      merchant.logo_url,
    ];

    let safeFaviconUrl: string | null = null;

    for (const urlStr of candidates) {
      if (!urlStr) continue;

      try {
        const parsedUrl = new URL(urlStr);

        // URL Safety: Ensure safe protocol (http/https only)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          console.warn(
            `[Favicon Router] Blocked unsafe redirect protocol: ${parsedUrl.protocol} for merchant ${slug}`
          );
          continue;
        }

        // Redirect Loop Prevention: Avoid redirecting to the request's own favicon.ico
        if (
          parsedUrl.pathname === '/favicon.ico' &&
          parsedUrl.hostname === requestUrl.hostname
        ) {
          console.warn(
            `[Favicon Router] Blocked self-referential redirect loop to /favicon.ico for merchant ${slug}`
          );
          continue;
        }

        // First validated candidate wins
        safeFaviconUrl = parsedUrl.toString();
        break;
      } catch (urlError) {
        console.warn(
          `[Favicon Router] Invalid merchant favicon URL candidate: ${urlStr} for merchant ${slug}`,
          urlError
        );
      }
    }

    if (safeFaviconUrl) {
      return buildRedirectResponse(safeFaviconUrl);
    }

    return buildRedirectResponse(fallbackUrl);
  } catch (err) {
    console.error(
      `[Favicon Router] Failed to resolve favicon for merchant ${slug}:`,
      err
    );
    return buildRedirectResponse(fallbackUrl);
  }
}
