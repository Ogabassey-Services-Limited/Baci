import { NextResponse } from 'next/server';

const NEWS_SITEMAP_PATH = '/blog/news-sitemap.xml';
const REDIRECT_CACHE_CONTROL =
  'public, max-age=3600, stale-while-revalidate=86400';

export function GET(request: Request): Response {
  const redirectUrl = new URL(NEWS_SITEMAP_PATH, request.url);
  const response = NextResponse.redirect(redirectUrl, 308);
  response.headers.set('cache-control', REDIRECT_CACHE_CONTROL);
  return response;
}
