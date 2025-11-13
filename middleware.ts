import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { hostname } = url;

  // Use a placeholder for the root domain, which you would replace with your actual domain in production.
  // We use a common pattern that should work for localhost and deployed environments.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.store';
  const isLocal = hostname.includes('localhost');
  
  // Clean up the hostname to get the main domain part
  const normalizedHost = hostname.replace(`.${rootDomain}`, '').replace(`.${isLocal ? 'localhost:3000' : rootDomain}`, '');

  if (hostname === `localhost:3000` || hostname === rootDomain || hostname === `www.${rootDomain}`) {
    // This is a request to the main marketing site, do nothing.
    return NextResponse.next();
  }

  // It's a storefront request. Extract the slug and rewrite to the internal _storefront page.
  // e.g., "ogabassey.baci.store" -> "ogabassey"
  const slug = normalizedHost;

  if (slug) {
    console.log(`Rewriting ${hostname} to /_storefront/${slug}`);
    url.pathname = `/_storefront/${slug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  // - /api/ (API routes)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
